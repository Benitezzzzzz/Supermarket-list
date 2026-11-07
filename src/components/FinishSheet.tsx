import { useEffect, useRef, useState } from "react";
import { describePayment, formatMoney } from "../domain/money";
import { BottomSheet } from "../ui/BottomSheet";
import { type PurchaseDetails, PurchaseForm } from "./PurchaseForm";

interface FinishSheetProps {
  itemCount: number;
  onFinish: (details: PurchaseDetails) => void;
  onClose: () => void;
}

/** Dois passos: os dados da compra e depois a pergunta "Finalizar lista?". */
export function FinishSheet({ itemCount, onFinish, onClose }: FinishSheetProps) {
  const [details, setDetails] = useState<PurchaseDetails | null>(null);
  const [confirming, setConfirming] = useState(false);
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (confirming) confirmRef.current?.focus();
  }, [confirming]);

  if (confirming && details) {
    return (
      <BottomSheet title="Finalizar lista?" onClose={onClose}>
        <div className="summary">
          <span className="summary__amount">{formatMoney(details.amountCents)}</span>
          <span className="summary__method">{describePayment(details)}</span>
        </div>
        <p className="hint">
          {itemCount === 1
            ? "O item da lista sai e a compra fica guardada em Gastos."
            : `Os ${itemCount} itens saem da lista e a compra fica guardada em Gastos.`}
        </p>
        <div className="sheet__actions">
          <button type="button" className="btn btn--secondary" onClick={() => setConfirming(false)}>
            Não, voltar
          </button>
          <button
            ref={confirmRef}
            type="button"
            className="btn btn--primary"
            onClick={() => onFinish(details)}
          >
            Sim, finalizar
          </button>
        </div>
      </BottomSheet>
    );
  }

  return (
    <BottomSheet title="Finalizar compra" onClose={onClose}>
      <PurchaseForm
        initial={details ?? undefined}
        submitLabel="Continuar"
        onSubmit={(next) => {
          setDetails(next);
          setConfirming(true);
        }}
      />
    </BottomSheet>
  );
}
