import { useEffect, useRef, useState } from "react";
import { describePayment, formatMoney } from "../domain/money";
import type { Item, Purchase, PurchasedItem } from "../domain/types";
import { BottomSheet } from "../ui/BottomSheet";
import { Icon } from "../ui/Icon";
import { type PurchaseDetails, PurchaseForm } from "./PurchaseForm";
import { type ReceiptResult, ReceiptSheet } from "./ReceiptSheet";

/** O que a compra guarda de cada item da lista, na mesma ordem (o cupom liga pela posição). */
export function purchasedItems(items: Item[]): PurchasedItem[] {
  return items.map(({ text, quantity, category, done }) => ({ text, quantity, category, done }));
}

export interface FinishExtras {
  /** Cupom lido antes de finalizar: vai para a compra assim que ela é criada. */
  receipt: ReceiptResult | null;
  /** Abrir os modelos com esta compra pronta para virar lista padrão. */
  saveAsTemplate: boolean;
}

interface FinishSheetProps {
  listId: string;
  items: Item[];
  onFinish: (details: PurchaseDetails, extras: FinishExtras) => void;
  onClose: () => void;
}

type Step = "form" | "receipt" | "confirm";

/**
 * Finalizar em até três passos: ler o cupom (opcional, preenche o valor e os preços),
 * o pagamento, e a pergunta "Finalizar lista?", com a opção de guardar a compra como modelo.
 */
export function FinishSheet({ listId, items, onFinish, onClose }: FinishSheetProps) {
  const [step, setStep] = useState<Step>("form");
  const [details, setDetails] = useState<PurchaseDetails | null>(null);
  const [receipt, setReceipt] = useState<ReceiptResult | null>(null);
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const itemCount = items.length;

  useEffect(() => {
    if (step === "confirm") confirmRef.current?.focus();
  }, [step]);

  if (step === "receipt") {
    // A compra ainda não existe: o cupom é lido sobre um rascunho com os itens de agora.
    const draft: Purchase = {
      id: "00000000-0000-4000-8000-000000000000",
      amountCents: 0,
      method: "pix",
      installments: 1,
      itemCount,
      memberName: "",
      createdAt: new Date().toISOString(),
      items: purchasedItems(items),
      receipt: receipt?.receipt ?? null,
    };
    return (
      <ReceiptSheet
        listId={listId}
        purchase={draft}
        draft
        onSave={(result) => {
          setReceipt(result);
          const read = result.receipt.totalCents;
          if (read) setDetails((current) => current && { ...current, amountCents: read });
          setStep("form");
        }}
        onBack={() => setStep("form")}
        onClose={onClose}
      />
    );
  }

  if (step === "confirm" && details) {
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
          {receipt && " O cupom lido vai junto."}
        </p>
        <label className="choice choice--card">
          <input type="checkbox" checked={saveAsTemplate} onChange={(event) => setSaveAsTemplate(event.target.checked)} />
          <span>
            <strong>Salvar como modelo de lista</strong>
            <span className="choice__note">Depois de finalizar, abre os modelos para dar um nome a esta compra.</span>
          </span>
        </label>
        <div className="sheet__actions">
          <button type="button" className="btn btn--secondary" onClick={() => setStep("form")}>
            Não, voltar
          </button>
          <button
            ref={confirmRef}
            type="button"
            className="btn btn--primary"
            onClick={() => onFinish(details, { receipt, saveAsTemplate })}
          >
            Sim, finalizar
          </button>
        </div>
      </BottomSheet>
    );
  }

  const total = receipt?.receipt.totalCents ?? null;
  const products = receipt?.receipt.items.length ?? 0;

  return (
    <BottomSheet title="Finalizar compra" onClose={onClose}>
      {receipt ? (
        <div className="notice finish-receipt" role="status">
          <span>
            <strong>Cupom lido</strong>
            {products > 0 && ` · ${products === 1 ? "1 produto" : `${products} produtos`}`}
            {receipt.receipt.storeName && ` · ${receipt.receipt.storeName}`}
            {total !== null && ` · ${formatMoney(total)}`}
          </span>
          <button type="button" className="btn btn--link btn--inline" onClick={() => setStep("receipt")}>
            Revisar
          </button>
        </div>
      ) : (
        <button type="button" className="finish-scan" onClick={() => setStep("receipt")}>
          <span className="finish-scan__icon" aria-hidden="true">
            <Icon name="receipt" size={26} />
          </span>
          <span className="finish-scan__text">
            <span className="finish-scan__title">Ler o cupom fiscal</span>
            <span className="finish-scan__note">Preenche o valor e os preços de cada item sozinho</span>
          </span>
        </button>
      )}
      <PurchaseForm
        // Ao ler o cupom, o formulário recomeça com o total dele.
        key={total ?? "sem-cupom"}
        initial={details ?? (total !== null ? { amountCents: total } : undefined)}
        submitLabel="Continuar"
        onSubmit={(next) => {
          setDetails(next);
          setStep("confirm");
        }}
      />
    </BottomSheet>
  );
}
