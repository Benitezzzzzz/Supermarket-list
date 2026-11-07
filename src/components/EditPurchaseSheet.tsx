import { useEffect, useRef, useState } from "react";
import { describePayment, formatMoney } from "../domain/money";
import type { Purchase } from "../domain/types";
import { BottomSheet } from "../ui/BottomSheet";
import { Icon } from "../ui/Icon";
import { type PurchaseDetails, PurchaseForm } from "./PurchaseForm";

interface EditPurchaseSheetProps {
  purchase: Purchase;
  onSave: (details: PurchaseDetails) => void;
  onDelete: () => void;
  onClose: () => void;
}

/** Corrige valor ou forma de pagamento, ou exclui a compra (com confirmação). */
export function EditPurchaseSheet({ purchase, onSave, onDelete, onClose }: EditPurchaseSheetProps) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (confirmingDelete) cancelRef.current?.focus();
  }, [confirmingDelete]);

  if (confirmingDelete) {
    return (
      <BottomSheet title="Excluir esta compra?" onClose={onClose}>
        <div className="summary">
          <span className="summary__amount">{formatMoney(purchase.amountCents)}</span>
          <span className="summary__method">{describePayment(purchase)}</span>
        </div>
        <p className="hint">A compra sai de Gastos e do total do mês. Dá para desfazer logo depois.</p>
        <div className="sheet__actions">
          <button
            ref={cancelRef}
            type="button"
            className="btn btn--secondary"
            onClick={() => setConfirmingDelete(false)}
          >
            Cancelar
          </button>
          <button type="button" className="btn btn--danger" onClick={onDelete}>
            Excluir
          </button>
        </div>
      </BottomSheet>
    );
  }

  return (
    <BottomSheet title="Corrigir compra" onClose={onClose}>
      <PurchaseForm initial={purchase} submitLabel="Salvar correção" onSubmit={onSave} />
      <button
        type="button"
        className="btn btn--danger-soft btn--block"
        onClick={() => setConfirmingDelete(true)}
      >
        <Icon name="trash" size={22} />
        Excluir compra
      </button>
    </BottomSheet>
  );
}
