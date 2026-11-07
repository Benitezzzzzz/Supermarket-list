import { type FormEvent, useEffect, useId, useRef, useState } from "react";
import {
  describePayment,
  formatMoney,
  MAX_INSTALLMENTS,
  PAYMENT_LABELS,
  parseMoney,
} from "../domain/money";
import type { PaymentMethod } from "../domain/types";
import { BottomSheet } from "../ui/BottomSheet";
import { Icon, type IconName } from "../ui/Icon";

export interface FinishDetails {
  amountCents: number;
  method: PaymentMethod;
  installments: number;
}

interface FinishSheetProps {
  itemCount: number;
  onFinish: (details: FinishDetails) => void;
  onClose: () => void;
}

const METHODS: { value: PaymentMethod; icon: IconName; tone: string }[] = [
  { value: "pix", icon: "pix", tone: "tone-limpeza" },
  { value: "debito", icon: "card", tone: "tone-padaria" },
  { value: "credito", icon: "card", tone: "tone-laticinios" },
];

/** Dois passos: os dados da compra e depois a pergunta "Finalizar lista?". */
export function FinishSheet({ itemCount, onFinish, onClose }: FinishSheetProps) {
  const [step, setStep] = useState<"form" | "confirm">("form");
  const [amountText, setAmountText] = useState("");
  const [method, setMethod] = useState<PaymentMethod | null>(null);
  const [split, setSplit] = useState(false);
  const [installments, setInstallments] = useState(2);
  const [error, setError] = useState("");
  const amountRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const methodName = useId();
  const splitName = useId();

  const amountCents = parseMoney(amountText);
  const details: FinishDetails | null =
    amountCents && method
      ? { amountCents, method, installments: method === "credito" && split ? installments : 1 }
      : null;

  useEffect(() => {
    if (step === "confirm") confirmRef.current?.focus();
  }, [step]);

  function next(event: FormEvent) {
    event.preventDefault();
    if (!amountCents) {
      setError("Digite o valor da compra, por exemplo 152,90.");
      amountRef.current?.focus();
      return;
    }
    if (!method) {
      setError("Escolha a forma de pagamento.");
      return;
    }
    setError("");
    setStep("confirm");
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
        </p>
        <div className="sheet__actions">
          <button type="button" className="btn btn--secondary" onClick={() => setStep("form")}>
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
      <form className="form" onSubmit={next} noValidate>
        <label htmlFor="valor-compra" className="field-label">
          Valor da compra
        </label>
        <div className="money">
          <span className="money__prefix" aria-hidden="true">
            R$
          </span>
          <input
            id="valor-compra"
            ref={amountRef}
            className="field money__input"
            type="text"
            inputMode="decimal"
            placeholder="0,00"
            autoComplete="off"
            data-autofocus
            value={amountText}
            onChange={(event) => setAmountText(event.target.value)}
          />
        </div>

        <fieldset className="tiles tiles--stack">
          <legend className="field-label">Forma de pagamento</legend>
          {METHODS.map((option) => (
            <label key={option.value} className={`tile ${option.tone}`}>
              <input
                type="radio"
                className="visually-hidden"
                name={methodName}
                value={option.value}
                checked={method === option.value}
                onChange={() => setMethod(option.value)}
              />
              <Icon name={option.icon} size={22} />
              <span>{PAYMENT_LABELS[option.value]}</span>
            </label>
          ))}
        </fieldset>

        {method === "credito" && (
          <fieldset className="tiles">
            <legend className="field-label">Parcelamento</legend>
            <label className="tile tone-laticinios">
              <input
                type="radio"
                className="visually-hidden"
                name={splitName}
                checked={!split}
                onChange={() => setSplit(false)}
              />
              <span>À vista</span>
            </label>
            <label className="tile tone-laticinios">
              <input
                type="radio"
                className="visually-hidden"
                name={splitName}
                checked={split}
                onChange={() => setSplit(true)}
              />
              <span>Parcelado</span>
            </label>
          </fieldset>
        )}

        {method === "credito" && split && (
          <>
            <span className="field-label">Quantas vezes?</span>
            <div className="stepper">
              <button
                type="button"
                className="stepper__btn"
                aria-label="Menos parcelas"
                disabled={installments <= 2}
                onClick={() => setInstallments(installments - 1)}
              >
                <Icon name="minus" size={26} strokeWidth={2.6} />
              </button>
              <output className="stepper__value" aria-label="Número de parcelas">
                {installments}x
              </output>
              <button
                type="button"
                className="stepper__btn"
                aria-label="Mais parcelas"
                disabled={installments >= MAX_INSTALLMENTS}
                onClick={() => setInstallments(installments + 1)}
              >
                <Icon name="plus" size={26} strokeWidth={2.6} />
              </button>
            </div>
            {amountCents && (
              <p className="hint">
                {installments}x de {formatMoney(Math.round(amountCents / installments))}
              </p>
            )}
          </>
        )}

        {error && (
          <p className="banner banner--danger" role="alert">
            {error}
          </p>
        )}

        <button type="submit" className="btn btn--primary btn--block btn--xl">
          Continuar
        </button>
      </form>
    </BottomSheet>
  );
}
