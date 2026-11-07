import { useEffect, useState, useSyncExternalStore } from "react";
import { AddSheet } from "./components/AddSheet";
import { BottomNav, type Screen } from "./components/BottomNav";
import { EditItemSheet } from "./components/EditItemSheet";
import { EditPurchaseSheet } from "./components/EditPurchaseSheet";
import { ExpensesScreen } from "./components/ExpensesScreen";
import { FamilyScreen } from "./components/FamilyScreen";
import { FinishSheet } from "./components/FinishSheet";
import { ImportSheet } from "./components/ImportSheet";
import { JoinScreen } from "./components/JoinScreen";
import { ListScreen } from "./components/ListScreen";
import type { SyncedList } from "./data/syncedList";
import { DEFAULT_CATEGORY, knownCategories } from "./domain/categories";
import { createItem } from "./domain/items";
import type { Item, SessionInfo } from "./domain/types";
import { ConfirmSheet } from "./ui/ConfirmSheet";
import { Icon } from "./ui/Icon";
import { Toast, useToast } from "./ui/Toast";

interface AppProps {
  list: SyncedList;
  session: SessionInfo;
  onRejoined: (session: SessionInfo) => void;
}

type Sheet =
  | { kind: "add" }
  | { kind: "import" }
  | { kind: "edit"; id: string }
  | { kind: "clear" }
  | { kind: "clear-all" }
  | { kind: "finish" }
  | { kind: "edit-purchase"; id: string }
  | null;

export function App({ list, session, onRejoined }: AppProps) {
  const state = useSyncExternalStore(list.subscribe, list.getState);
  const [screen, setScreen] = useState<Screen>("list");
  const [sheet, setSheet] = useState<Sheet>(null);
  const [category, setCategory] = useState(DEFAULT_CATEGORY);
  const { toast, show, dismiss } = useToast();

  useEffect(() => list.start(), [list]);

  if (state.accessRevoked) return <JoinScreen revoked onJoined={onRejoined} />;

  const categories = knownCategories(state.customCategories, state.items);
  const editing = sheet?.kind === "edit" ? state.items.find((item) => item.id === sheet.id) : undefined;
  const editingPurchase =
    sheet?.kind === "edit-purchase" ? state.purchases.find((purchase) => purchase.id === sheet.id) : undefined;
  const close = () => setSheet(null);

  /** Remove e oferece desfazer: os mesmos itens voltam com o mesmo id e a mesma ordem. */
  function removeWithUndo(items: Item[], message: string) {
    list.removeItems(items.map((item) => item.id));
    show(message, { label: "Desfazer", onAction: () => list.addItems(items) });
  }

  function createCategory(name: string) {
    const existing = categories.find((c) => c.toLowerCase() === name.toLowerCase());
    if (!existing) list.addCategory(name);
    setCategory(existing ?? name);
  }

  return (
    <main className={screen === "list" ? "app app--with-fab" : "app"}>
      {screen === "list" && (
        <ListScreen
          state={state}
          session={session}
          onToggle={(item) => list.updateItem(item.id, { done: !item.done })}
          onEdit={(item) => setSheet({ kind: "edit", id: item.id })}
          onAskClear={() => setSheet({ kind: "clear" })}
          onAskClearAll={() => setSheet({ kind: "clear-all" })}
          onFinish={() => setSheet({ kind: "finish" })}
        />
      )}
      {screen === "expenses" && (
        <ExpensesScreen
          purchases={state.purchases}
          onEdit={(purchase) => setSheet({ kind: "edit-purchase", id: purchase.id })}
        />
      )}
      {screen === "family" && <FamilyScreen session={session} />}

      {screen === "list" && (
        <button type="button" className="fab" onClick={() => setSheet({ kind: "add" })}>
          <Icon name="plus" size={26} strokeWidth={2.6} />
          Adicionar
        </button>
      )}

      <BottomNav screen={screen} onNavigate={setScreen} />

      <Toast toast={toast} onDismiss={dismiss} />

      {sheet?.kind === "add" && (
        <AddSheet
          categories={categories}
          category={category}
          onCategoryChange={setCategory}
          onCreateCategory={createCategory}
          onAdd={(text) => {
            const item = createItem(text, category);
            list.addItems([item]);
            return item.quantity > 1 ? `${item.quantity}× ${item.text}` : item.text;
          }}
          onOpenImport={() => setSheet({ kind: "import" })}
          onClose={close}
        />
      )}

      {sheet?.kind === "import" && (
        <ImportSheet
          categories={categories}
          initialCategory={category}
          onImport={(items) => {
            list.addItems(items);
            close();
            show(items.length === 1 ? "1 item importado" : `${items.length} itens importados`, {
              label: "Desfazer",
              onAction: () => list.removeItems(items.map((item) => item.id)),
            });
          }}
          onClose={close}
        />
      )}

      {editing && (
        <EditItemSheet
          item={editing}
          categories={categories}
          onUpdate={(changes) => list.updateItem(editing.id, changes)}
          onRemove={() => {
            close();
            removeWithUndo([editing], `${editing.text} saiu da lista`);
          }}
          onClose={close}
        />
      )}

      {sheet?.kind === "clear" && (
        <ConfirmSheet
          title="Limpar o carrinho?"
          message="Os itens marcados como comprados saem da lista. Dá para desfazer logo depois."
          confirmLabel="Limpar"
          onConfirm={() => {
            const bought = state.items.filter((item) => item.done);
            close();
            removeWithUndo(bought, bought.length === 1 ? "1 item saiu da lista" : `${bought.length} itens saíram da lista`);
          }}
          onClose={close}
        />
      )}

      {sheet?.kind === "finish" && (
        <FinishSheet
          itemCount={state.items.length}
          onFinish={(details) => {
            const itemIds = state.items.map((item) => item.id);
            list.finishShopping(
              {
                id: crypto.randomUUID(),
                ...details,
                itemCount: itemIds.length,
                memberName: session.name,
                createdAt: new Date().toISOString(),
              },
              itemIds,
            );
            close();
            show("Compra finalizada e guardada em Gastos");
          }}
          onClose={close}
        />
      )}

      {editingPurchase && (
        <EditPurchaseSheet
          purchase={editingPurchase}
          onSave={(payment) => {
            list.updatePurchase(editingPurchase.id, payment);
            close();
            show("Compra corrigida");
          }}
          onClose={close}
        />
      )}

      {sheet?.kind === "clear-all" && (
        <ConfirmSheet
          title="Limpar a lista toda?"
          message={`Todos os ${state.items.length} itens saem da lista, comprados ou não. Dá para desfazer logo depois.`}
          confirmLabel="Limpar tudo"
          onConfirm={() => {
            const all = state.items;
            close();
            removeWithUndo(all, "Lista limpa");
          }}
          onClose={close}
        />
      )}
    </main>
  );
}
