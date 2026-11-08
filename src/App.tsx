import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { AccountSheet } from "./components/AccountSheet";
import { AddSheet } from "./components/AddSheet";
import { AdminSheet } from "./components/AdminSheet";
import { BottomNav, type Screen } from "./components/BottomNav";
import { ClearSheet } from "./components/ClearSheet";
import { EditItemSheet } from "./components/EditItemSheet";
import { EditPurchaseSheet } from "./components/EditPurchaseSheet";
import { ExpensesScreen } from "./components/ExpensesScreen";
import { FinishSheet } from "./components/FinishSheet";
import { ImportSheet } from "./components/ImportSheet";
import { takeSharedText } from "./sharedText";
import { ListScreen } from "./components/ListScreen";
import { ListsSheet } from "./components/ListsSheet";
import { ParticipantsScreen } from "./components/ParticipantsScreen";
import { PricesSheet } from "./components/PricesSheet";
import { ReceiptSheet } from "./components/ReceiptSheet";
import { TemplatesSheet } from "./components/TemplatesSheet";
import type { SyncedList } from "./data/syncedList";
import { DEFAULT_CATEGORY, knownCategories } from "./domain/categories";
import { createItem } from "./domain/items";
import { buildPriceIndex, lastPrice, pricesFor, productKey } from "./domain/prices";
import { itemsFromTemplate } from "./domain/templates";
import type { Item, ListSummary, Template, UserInfo } from "./domain/types";
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
  onRenameList: (listId: string, name: string) => Promise<void>;
  onListsChanged: () => void;
  onLogout: () => void;
  onSessionLost: () => void;
  onListLost: () => void;
}

type Sheet =
  | { kind: "add" }
  | { kind: "import"; text?: string }
  | { kind: "edit"; id: string }
  | { kind: "clear" }
  | { kind: "finish" }
  | { kind: "edit-purchase"; id: string; confirmDelete?: boolean }
  | { kind: "receipt"; id: string }
  | { kind: "prices"; id: string }
  | { kind: "templates" }
  | { kind: "lists" }
  | { kind: "account" }
  | { kind: "admin" }
  | null;

export function App({
  list,
  user,
  current,
  lists,
  notice,
  onSwitchList,
  onCreateList,
  onRenameList,
  onListsChanged,
  onLogout,
  onSessionLost,
  onListLost,
}: AppProps) {
  const state = useSyncExternalStore(list.subscribe, list.getState);
  const [screen, setScreen] = useState<Screen>("list");
  const [sheet, setSheet] = useState<Sheet>(() => {
    const shared = takeSharedText();
    return shared ? { kind: "import", text: shared } : null;
  });
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
  const receiptPurchase =
    sheet?.kind === "receipt" ? state.purchases.find((purchase) => purchase.id === sheet.id) : undefined;
  const pricesPurchase =
    sheet?.kind === "prices" ? state.purchases.find((purchase) => purchase.id === sheet.id) : undefined;

  /** Preços já pagos, por produto: base da referência na lista e do histórico de cada item. */
  const priceIndex = useMemo(() => buildPriceIndex(state.purchases), [state.purchases]);
  const findLastPrice = useCallback((text: string) => lastPrice(priceIndex, text), [priceIndex]);

  /** Categoria que o produto já teve na lista ou numa compra; serve para itens novos de modelo. */
  function categoryFor(text: string): string {
    const key = productKey(text);
    const inList = state.items.find((item) => productKey(item.text) === key);
    if (inList) return inList.category;
    for (const purchase of state.purchases) {
      const found = purchase.items.find((item) => productKey(item.text) === key);
      if (found) return found.category;
    }
    return DEFAULT_CATEGORY;
  }

  function applyTemplate(template: Template) {
    const items = itemsFromTemplate(template, state.items);
    close();
    if (items.length === 0) {
      show(`Os itens de ${template.name} já estão na lista`);
      return;
    }
    list.addItems(items);
    show(
      items.length === 1 ? `1 item de ${template.name} entrou na lista` : `${items.length} itens de ${template.name} entraram na lista`,
      { label: "Desfazer", onAction: () => list.removeItems(items.map((item) => item.id)) },
    );
  }
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
          lastPrice={findLastPrice}
          onOpenTemplates={() => setSheet({ kind: "templates" })}
          onUseTemplate={applyTemplate}
        />
      )}
      {screen === "expenses" && (
        <ExpensesScreen
          purchases={state.purchases}
          listId={current.id}
          listName={current.name}
          onEdit={(purchase) => setSheet({ kind: "edit-purchase", id: purchase.id })}
          onPrices={(purchase) => setSheet({ kind: "prices", id: purchase.id })}
          onDelete={(purchase) => setSheet({ kind: "edit-purchase", id: purchase.id, confirmDelete: true })}
          onReceipt={(purchase) => setSheet({ kind: "receipt", id: purchase.id })}
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
          lastPrice={findLastPrice}
        />
      )}

      {sheet?.kind === "import" && (
        <ImportSheet
          categories={categories}
          initialCategory={category}
          listName={current.name}
          initialText={sheet.text}
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
          prices={pricesFor(priceIndex, editing.text)}
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
          onRename={onRenameList}
          onClose={close}
        />
      )}

      {sheet?.kind === "account" && (
        <AccountSheet user={user} onLogout={onLogout} onOpenAdmin={() => setSheet({ kind: "admin" })} onClose={close} />
      )}

      {sheet?.kind === "admin" && <AdminSheet user={user} onClose={close} />}

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
          startWithDelete={sheet?.kind === "edit-purchase" && sheet.confirmDelete === true}
          onSave={(payment) => {
            list.updatePurchase(editingPurchase.id, payment);
            close();
            show("Compra atualizada");
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

      {pricesPurchase && (
        <PricesSheet
          purchase={pricesPurchase}
          prices={priceIndex}
          onSave={(prices, amountCents) => {
            list.updatePrices(pricesPurchase.id, prices, amountCents);
            close();
            show(amountCents === null ? "Preços salvos" : "Preços salvos e valor da compra atualizado");
          }}
          onClose={close}
        />
      )}

      {sheet?.kind === "templates" && (
        <TemplatesSheet
          templates={state.templates}
          items={state.items}
          categoryFor={categoryFor}
          onUse={applyTemplate}
          onSave={(template) => {
            list.saveTemplate(template);
            show(`Modelo ${template.name} salvo`);
          }}
          onDelete={(template) => {
            list.deleteTemplate(template.id);
            show(`Modelo ${template.name} excluído`, { label: "Desfazer", onAction: () => list.saveTemplate(template) });
          }}
          onClose={close}
        />
      )}

      {receiptPurchase && (
        <ReceiptSheet
          listId={current.id}
          purchase={receiptPurchase}
          onSave={({ receipt, amountCents, returnItems }) => {
            list.setReceipt(receiptPurchase.id, receipt);
            if (amountCents !== null) {
              list.updatePurchase(receiptPurchase.id, {
                amountCents,
                method: receiptPurchase.method,
                installments: receiptPurchase.installments,
              });
            }
            const now = Date.now();
            list.addItems(
              returnItems.map((item, index) => ({
                id: crypto.randomUUID(),
                text: item.text,
                quantity: item.quantity,
                category: item.category,
                done: false,
                createdAt: new Date(now + index).toISOString(),
              })),
            );
            close();
            const back = returnItems.length;
            show(
              back === 0
                ? "Cupom salvo na compra"
                : `Cupom salvo. ${back === 1 ? "1 item voltou" : `${back} itens voltaram`} para a lista`,
            );
          }}
          onRemove={() => {
            list.removeReceipt(receiptPurchase.id);
            close();
            show("Cupom removido da compra");
          }}
          onClose={close}
        />
      )}
    </main>
  );
}
