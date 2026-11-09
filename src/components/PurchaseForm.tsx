import { type FormEvent, useId, useRef, useState } from "react";
import { MAX_STORE } from "../../shared/contract.ts";
import {
  centsToInput,
  formatMoney,
  MAX_INSTALLMENTS,
  PAYMENT_LABELS,
  parseMoney,
} from "../domain/money";
import type { PaymentMethod } from "../domain/types";
import { Icon, type IconName } from "../ui/Icon";

export interface PurchaseDetails {
  amountCents: number;
  method: PaymentMethod;
  installments: number;
  /** Mercado onde comprou; vazio quando a pessoa não escreveu. */
  store: string;
}

interface PurchaseFormProps {
  /** No Finalizar com cupom lido, só o valor vem preenchido. */
  initial?: Partial<PurchaseDetails>;
  submitLabel: string;
  onSubmit: (details: PurchaseDetails) => void;
  /** Mercados já usados, sugeridos ao digitar. */
  stores?: string[];
}

const METHODS: { value: PaymentMethod; icon: IconName; tone: string }[] = [
  { value: "pix", icon: "pix", tone: "tone-limpeza" },
  { value: "dinheiro", icon: "cash", tone: "tone-horti" },
  { value: "debito", icon: "card", tone: "tone-padaria" },
  { value: "credito", icon: "card", tone: "tone-laticinios" },
];

/** Valor e forma de pagamento. Usado ao finalizar e ao corrigir uma compra. */
export function PurchaseForm({ initial, submitLabel, onSubmit, stores = [] }: PurchaseFormProps) {
  const [store, setStore] = useState(initial?.store ?? "");
  const storesId = useId();
  const [amountText, setAmountText] = useState(initial?.amountCents ? centsToInput(initial.amountCents) : "");
  const [method, setMethod] = useState<PaymentMethod | null>(initial?.method ?? null);
  const [split, setSplit] = useState((initial?.installments ?? 1) > 1);
  const [installments, setInstallments] = useState(Math.max(2, initial?.installments ?? 2));
  const [error, setError] = useState("");
  const amountRef = useRef<HTMLInputElement>(null);
  const methodName = useId();
  const splitName = useId();
  const amountCents = parseMoney(amountText);

  function submit(event: FormEvent) {
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
    onSubmit({
      amountCents,
      method,
      installments: method === "credito" && split ? installments : 1,
      store: store.trim().replace(/\s+/g, " "),
    });
  }

  return (
    <form className="form" onSubmit={submit} noValidate>
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

      <label htmlFor="mercado-compra" className="field-label">
        Mercado <span className="field-label__optional">(opcional)</span>
      </label>
      <input
        id="mercado-compra"
        className="field"
        type="text"
        placeholder="Ex.: Atacadão"
        autoComplete="off"
        maxLength={MAX_STORE}
        list={stores.length > 0 ? storesId : undefined}
        value={store}
        onChange={(event) => setStore(event.target.value)}
      />
      {stores.length > 0 && (
        <datalist id={storesId}>
          {stores.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
      )}
      {stores.length > 0 && !store && (
        <fieldset className="store-chips">
          <legend className="visually-hidden">Mercados já usados</legend>
          {stores.slice(0, 4).map((name) => (
            <button key={name} type="button" className="chip chip--small" onClick={() => setStore(name)}>
              {name}
            </button>
          ))}
        </fieldset>
      )}

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
        {submitLabel}
      </button>
    </form>
  );
}
