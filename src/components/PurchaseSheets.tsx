import type { SyncedList } from "../data/syncedList";
import type { PriceIndex } from "../domain/prices";
import { knownStores } from "../domain/storeName";
import type { Purchase } from "../domain/types";
import { EditPurchaseSheet } from "./EditPurchaseSheet";
import { PricesSheet } from "./PricesSheet";
import { ReceiptSheet } from "./ReceiptSheet";

/** Painéis que mexem numa compra já finalizada, abertos a partir de Gastos. */
export type PurchaseSheet =
  | { kind: "edit-purchase"; id: string; confirmDelete?: boolean }
  | { kind: "prices"; id: string }
  | { kind: "receipt"; id: string };

export function isPurchaseSheet(sheet: { kind: string } | null): sheet is PurchaseSheet {
  return sheet?.kind === "edit-purchase" || sheet?.kind === "prices" || sheet?.kind === "receipt";
}

interface PurchaseSheetsProps {
  sheet: PurchaseSheet;
  purchases: Purchase[];
  listId: string;
  list: SyncedList;
  prices: PriceIndex;
  show: (text: string, action?: { label: string; onAction: () => void }) => void;
  onClose: () => void;
}

/** Editar ou excluir, anotar preços e ler o cupom de uma compra. */
export function PurchaseSheets({ sheet, purchases, listId, list, prices, show, onClose }: PurchaseSheetsProps) {
  const purchase = purchases.find((entry) => entry.id === sheet.id);
  // A compra pode ter sido excluída em outro aparelho com o painel aberto.
  if (!purchase) return null;

  if (sheet.kind === "edit-purchase") {
    return (
      <EditPurchaseSheet
        purchase={purchase}
        startWithDelete={sheet.confirmDelete === true}
        stores={knownStores(purchases)}
        onSave={(payment) => {
          list.updatePurchase(purchase.id, payment);
          onClose();
          show("Compra atualizada");
        }}
        onDelete={() => {
          list.deletePurchase(purchase.id);
          onClose();
          show("Compra excluída", { label: "Desfazer", onAction: () => list.restorePurchase(purchase) });
        }}
        onClose={onClose}
      />
    );
  }

  if (sheet.kind === "prices") {
    return (
      <PricesSheet
        purchase={purchase}
        prices={prices}
        onSave={(changes, amountCents) => {
          list.updatePrices(purchase.id, changes, amountCents);
          onClose();
          show(amountCents === null ? "Preços salvos" : "Preços salvos e valor da compra atualizado");
        }}
        onClose={onClose}
      />
    );
  }

  return (
    <ReceiptSheet
      listId={listId}
      purchase={purchase}
      onSave={({ receipt, amountCents, returnItems }) => {
        list.setReceipt(purchase.id, receipt);
        if (amountCents !== null) {
          list.updatePurchase(purchase.id, {
            amountCents,
            method: purchase.method,
            installments: purchase.installments,
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
        onClose();
        const back = returnItems.length;
        show(
          back === 0
            ? "Cupom salvo na compra"
            : `Cupom salvo. ${back === 1 ? "1 item voltou" : `${back} itens voltaram`} para a lista`,
        );
      }}
      onRemove={() => {
        list.removeReceipt(purchase.id);
        onClose();
        show("Cupom removido da compra");
      }}
      onClose={onClose}
    />
  );
}
