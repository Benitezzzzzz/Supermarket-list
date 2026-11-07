import type { Purchase } from "../domain/types";
import { BottomSheet } from "../ui/BottomSheet";
import { type PurchaseDetails, PurchaseForm } from "./PurchaseForm";

interface EditPurchaseSheetProps {
  purchase: Purchase;
  onSave: (details: PurchaseDetails) => void;
  onClose: () => void;
}

/** Corrige valor ou forma de pagamento de uma compra já finalizada. */
export function EditPurchaseSheet({ purchase, onSave, onClose }: EditPurchaseSheetProps) {
  return (
    <BottomSheet title="Corrigir compra" onClose={onClose}>
      <PurchaseForm initial={purchase} submitLabel="Salvar correção" onSubmit={onSave} />
    </BottomSheet>
  );
}
