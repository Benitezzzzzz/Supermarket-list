import { useEffect, useState, useSyncExternalStore } from "react";
import { AccountSheet } from "./components/AccountSheet";
import { AddSheet } from "./components/AddSheet";
import { BottomNav, type Screen } from "./components/BottomNav";
import { ClearSheet } from "./components/ClearSheet";
import { EditItemSheet } from "./components/EditItemSheet";
import { EditPurchaseSheet } from "./components/EditPurchaseSheet";
import { ExpensesScreen } from "./components/ExpensesScreen";
import { FinishSheet } from "./components/FinishSheet";
import { ImportSheet } from "./components/ImportSheet";
import { ListScreen } from "./components/ListScreen";
import { ListsSheet } from "./components/ListsSheet";
import { ParticipantsScreen } from "./components/ParticipantsScreen";
import type { SyncedList } from "./data/syncedList";
import { DEFAULT_CATEGORY, knownCategories } from "./domain/categories";
import { createItem } from "./domain/items";
import type { Item, ListSummary, UserInfo } from "./domain/types";
import { Icon } from "./ui/Icon";
import { Toast, useToast } from "./ui/Toast";

interface AppProps {
  list: SyncedList;
  user: UserInfo;
  current: ListSummary;
  lists: ListSummary[];
  /** Aviso vindo de fora, como "você não participa mais daquela lista". */
  notice?: string;
  onSwitchList: (listId: string) => void;
  onCreateList: (name: string) => Promise<void>;
  onListsChanged: () => void;
  onLogout: () => void;
  onSessionLost: () => void;
  onListLost: () => void;
}

type Sheet =
  | { kind: "add" }
  | { kind: "import" }
  | { kind: "edit"; id: string }
  | { kind: "clear" }
  | { kind: "finish" }
  | { kind: "edit-purchase"; id: string }
  | { kind: "lists" }
  | { kind: "account" }
  | null;

export function App({
  list,
  user,
  current,
  lists,
  notice,
  onSwitchList,
  onCreateList,
  onListsChanged,
  onLogout,
  onSessionLost,
  onListLost,
}: AppProps) {
  const state = useSyncExternalStore(list.subscribe, list.getState);
  const [screen, setScreen] = useState<Screen>("list");
  const [sheet, setSheet] = useState<Sheet>(null);
  const [category, setCategory] = useState(DEFAULT_CATEGORY);
  const { toast, show, dismiss } = useToast();

  useEffect(() => list.start(), [list]);

  useEffect(() => {
    if (state.accessRevoked === "session") onSessionLost();
    if (state.accessRevoked === "list") onListLost();
  }, [state.accessRevoked, onSessionLost, onListLost]);

  useEffect(() => {
    if (notice) show(notice);
  }, [notice, show]);

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
          user={user}
          current={current}
          onOpenLists={() => setSheet({ kind: "lists" })}
          onOpenAccount={() => setSheet({ kind: "account" })}
          onToggle={(item) => list.updateItem(item.id, { done: !item.done })}
          onEdit={(item) => setSheet({ kind: "edit", id: item.id })}
          onAskClearAll={() => setSheet({ kind: "clear" })}
        />
      )}
      {screen === "expenses" && (
        <ExpensesScreen
          purchases={state.purchases}
          onEdit={(purchase) => setSheet({ kind: "edit-purchase", id: purchase.id })}
        />
      )}
      {screen === "family" && <ParticipantsScreen user={user} list={current} onListsChanged={onListsChanged} />}

      {/* Ações principais fixas acima do menu: sempre visíveis, sem cobrir nada. */}
      {screen === "list" && (
        <div className="action-bar">
          <div className="action-bar__inner">
            {state.items.length > 0 && (
              <button
                type="button"
                className="btn btn--accent btn--xl"
                aria-label="Finalizar compra"
                onClick={() => setSheet({ kind: "finish" })}
              >
                <Icon name="bag" size={24} />
                Finalizar
              </button>
            )}
            <button type="button" className="btn btn--primary btn--xl" onClick={() => setSheet({ kind: "add" })}>
              <Icon name="plus" size={26} strokeWidth={2.6} />
              Adicionar
            </button>
          </div>
        </div>
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

      {sheet?.kind === "lists" && (
        <ListsSheet
          lists={lists}
          currentId={current.id}
          onPick={(id) => {
            close();
            if (id !== current.id) onSwitchList(id);
          }}
          onCreate={async (name) => {
            await onCreateList(name);
            close();
          }}
          onClose={close}
        />
      )}

      {sheet?.kind === "account" && <AccountSheet user={user} onLogout={onLogout} onClose={close} />}

      {sheet?.kind === "clear" && (
        <ClearSheet
          doneCount={state.items.filter((item) => item.done).length}
          totalCount={state.items.length}
          onClearDone={() => {
            const done = state.items.filter((item) => item.done);
            close();
            removeWithUndo(done, done.length === 1 ? "1 item riscado saiu da lista" : `${done.length} itens riscados saíram da lista`);
          }}
          onClearAll={() => {
            const all = state.items;
            close();
            removeWithUndo(all, "Lista limpa");
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
                memberName: user.displayName,
                createdAt: new Date().toISOString(),
                items: state.items.map(({ text, quantity, category, done }) => ({
                  text,
                  quantity,
                  category,
                  done,
                })),
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
          onDelete={() => {
            const removed = editingPurchase;
            list.deletePurchase(removed.id);
            close();
            show("Compra excluída", { label: "Desfazer", onAction: () => list.restorePurchase(removed) });
          }}
          onClose={close}
        />
      )}

    </main>
  );
}
