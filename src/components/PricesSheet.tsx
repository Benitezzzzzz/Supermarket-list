import { type FormEvent, useMemo, useState } from "react";
import { MAX_BRAND } from "../../shared/contract.ts";
import { centsToInput, formatMoney } from "../domain/money";
import { knownBrands, lastPrice, type PriceIndex, parsePrice, pricesFor, receiptPrice } from "../domain/prices";
import type { ItemPrice, Purchase } from "../domain/types";
import { BottomSheet } from "../ui/BottomSheet";

interface PricesSheetProps {
  purchase: Purchase;
  prices: PriceIndex;
  onSave: (prices: ItemPrice[], amountCents: number | null) => void;
  onClose: () => void;
}

const dayFormat = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short", year: "2-digit" });

interface Row {
  price: string;
  brand: string;
}

/**
 * Preço de cada item e a marca, quando a pessoa quiser. Nada é obrigatório: o que ficar em
 * branco continua sem preço (ou com o do cupom). O último preço aparece como referência,
 * nunca preenchido sozinho.
 */
export function PricesSheet({ purchase, prices, onSave, onClose }: PricesSheetProps) {
  const [rows, setRows] = useState<Row[]>(() =>
    purchase.items.map((item) => ({
      price: item.unitCents !== undefined && item.unitCents !== null ? centsToInput(item.unitCents) : "",
      brand: item.brand ?? "",
    })),
  );
  const [error, setError] = useState("");

  /** Preço que vale para cada item com o que está digitado agora. */
  const effective = rows.map((row, index) => {
    const typed = parsePrice(row.price);
    if (typed === undefined) return null;
    if (typed !== null) return typed * purchase.items[index].quantity;
    return receiptPrice(purchase, index)?.totalCents ?? null;
  });
  const priced = effective.filter((cents) => cents !== null).length;
  const sum = effective.reduce<number>((total, cents) => total + (cents ?? 0), 0);
  const bought = purchase.items.map((item, index) => ({ item, index })).filter(({ item }) => item.done);
  const allBoughtPriced = bought.length > 0 && bought.every(({ index }) => effective[index] !== null);
  const [useSum, setUseSum] = useState(() => !purchase.receipt && allBoughtPriced);

  const references = useMemo(
    () =>
      purchase.items.map((item) => ({
        last: lastPrice(prices, item.text, purchase.id),
        brands: knownBrands(pricesFor(prices, item.text)),
      })),
    [purchase, prices],
  );

  function change(index: number, changes: Partial<Row>) {
    setRows((current) => current.map((row, position) => (position === index ? { ...row, ...changes } : row)));
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const result: ItemPrice[] = [];
    for (const [index, row] of rows.entries()) {
      const unitCents = parsePrice(row.price);
      if (unitCents === undefined) {
        setError(`O preço de ${purchase.items[index].text} não está certo. Use, por exemplo, 6,49.`);
        document.getElementById(`preco-${index}`)?.focus();
        return;
      }
      const item = purchase.items[index];
      const before = item.unitCents ?? null;
      if (unitCents !== before || row.brand.trim() !== (item.brand ?? "")) {
        result.push({ index, unitCents, brand: row.brand.trim(), priceSource: "manual" });
      }
    }
    const amount = useSum && sum > 0 ? sum : null;
    if (result.length === 0 && (amount === null || amount === purchase.amountCents)) {
      onClose();
      return;
    }
    onSave(result, amount);
  }

  return (
    <BottomSheet title="Preços e marcas" onClose={onClose}>
      <form className="form" onSubmit={submit} noValidate>
        <p className="hint">
          Preencha só o que quiser. O preço é de cada unidade; o que ficar em branco continua sem preço.
        </p>
        <ul className="price-rows">
          {purchase.items.map((item, index) => {
            const { last, brands } = references[index];
            const fromReceipt = receiptPrice(purchase, index);
            const listId = `marcas-${index}`;
            return (
              // biome-ignore lint/suspicious/noArrayIndexKey: os itens de uma compra têm posição fixa.
              <li key={index} className="price-row">
                <span className="price-row__name">
                  <span className="qty">{item.quantity}×</span>
                  {item.text}
                  {!item.done && <small> (não marcado)</small>}
                </span>
                <div className="price-row__fields">
                  <label className="price-row__field">
                    <span className="field-label field-label--small">{item.quantity > 1 ? "Preço de cada" : "Preço"}</span>
                    <input
                      id={`preco-${index}`}
                      className="field"
                      type="text"
                      inputMode="decimal"
                      autoComplete="off"
                      placeholder={fromReceipt ? centsToInput(fromReceipt.unitCents) : "0,00"}
                      aria-label={`Preço de ${item.text}`}
                      value={rows[index].price}
                      onChange={(event) => change(index, { price: event.target.value })}
                    />
                  </label>
                  <label className="price-row__field">
                    <span className="field-label field-label--small">Marca</span>
                    <input
                      className="field"
                      type="text"
                      autoComplete="off"
                      maxLength={MAX_BRAND}
                      list={brands.length > 0 ? listId : undefined}
                      aria-label={`Marca de ${item.text}`}
                      value={rows[index].brand}
                      onChange={(event) => change(index, { brand: event.target.value })}
                    />
                  </label>
                  {brands.length > 0 && (
                    <datalist id={listId}>
                      {brands.map((brand) => (
                        <option key={brand} value={brand} />
                      ))}
                    </datalist>
                  )}
                </div>
                {fromReceipt && !rows[index].price.trim() && (
                  <small className="price-row__ref">Pelo cupom: {formatMoney(fromReceipt.totalCents)}</small>
                )}
                {last && (
                  <small className="price-row__ref">
                    Última compra: {formatMoney(last.unitCents)}
                    {last.quantity > 1 ? " cada" : ""}
                    {last.brand && ` · ${last.brand}`} · {dayFormat.format(new Date(last.date))}
                  </small>
                )}
              </li>
            );
          })}
        </ul>

        <div className="price-total">
          <span>
            Soma dos preços ({priced} de {purchase.items.length})
          </span>
          <strong>{formatMoney(sum)}</strong>
        </div>
        <label className="choice">
          <input type="checkbox" checked={useSum} disabled={sum === 0} onChange={(event) => setUseSum(event.target.checked)} />
          <span>
            Usar a soma como valor da compra
            <small> (hoje: {formatMoney(purchase.amountCents)})</small>
          </span>
        </label>

        {error && (
          <p className="banner banner--danger" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="btn btn--primary btn--block btn--xl">
          Salvar preços
        </button>
      </form>
    </BottomSheet>
  );
}
