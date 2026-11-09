import { formatMoney } from "../domain/money";
import { itemPrice, pricedTotal } from "../domain/prices";
import { formatQuantity, relate } from "../domain/receipt";
import type { Purchase } from "../domain/types";

/** Itens da compra pela posição, com marca e preço quando houver. */
function ItemLines({ purchase, indexes }: { purchase: Purchase; indexes: number[] }) {
  return (
    <ul className="purchase__list">
      {indexes.map((index) => {
        const item = purchase.items[index];
        const price = itemPrice(purchase, index);
        const detail = [
          item.brand,
          price && item.quantity > 1 ? `${item.quantity} × ${formatMoney(price.unitCents)}` : "",
        ]
          .filter(Boolean)
          .join(" · ");
        return (
          <li key={index} className="purchase__priced">
            <span className="purchase__priced-name">
              <span className="purchase__item-line">
                <span className="qty">{item.quantity}×</span>
                <span>{item.text}</span>
              </span>
              {detail && <small>{detail}</small>}
            </span>
            {price && <span className="purchase__priced-value">{formatMoney(price.totalCents)}</span>}
          </li>
        );
      })}
    </ul>
  );
}

/** Com cupom: cada item da lista com o preço pago, o que veio fora da lista e o que faltou. */
function ReceiptItems({ purchase }: { purchase: Purchase }) {
  const receipt = purchase.receipt;
  if (!receipt) return null;
  const { matched, extras, missing, itemsTotalCents } = relate(purchase.items, receipt);

  return (
    <>
      {matched.length > 0 && (
        <>
          <h3 className="purchase__group">Da lista · {matched.length}</h3>
          <ul className="purchase__list">
            {matched.map(({ index, item, lines }) => {
              const price = itemPrice(purchase, index);
              const fromReceipt = lines.map((line) => `${line.description} (${formatQuantity(line)})`).join(" + ");
              return (
                <li key={index} className="purchase__priced">
                  <span className="purchase__priced-name">
                    {item.text}
                    <small>{item.brand ? `${item.brand} · ${fromReceipt}` : fromReceipt}</small>
                  </span>
                  {price && <span className="purchase__priced-value">{formatMoney(price.totalCents)}</span>}
                </li>
              );
            })}
          </ul>
        </>
      )}
      {extras.length > 0 && (
        <>
          <h3 className="purchase__group">Fora da lista · {extras.length}</h3>
          <ul className="purchase__list">
            {extras.map((line, index) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: linhas fixas do cupom.
              <li key={index} className="purchase__priced">
                <span className="purchase__priced-name">
                  {line.description}
                  <small>{formatQuantity(line)}</small>
                </span>
                <span className="purchase__priced-value">{formatMoney(line.totalCents)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
      {missing.length > 0 && (
        <>
          <h3 className="purchase__group">Faltou comprar · {missing.length}</h3>
          <ItemLines purchase={purchase} indexes={missing.map(({ index }) => index)} />
        </>
      )}
      <p className="purchase__subtotal">
        <span>Soma dos produtos do cupom</span>
        <strong>{formatMoney(itemsTotalCents)}</strong>
      </p>
    </>
  );
}

/** A lista que estava na compra: com cupom, os preços; sem cupom, o que foi comprado e o que ficou para trás. */
export function PurchaseDetails({ purchase }: { purchase: Purchase }) {
  if (purchase.receipt && purchase.receipt.items.length > 0) return <ReceiptItems purchase={purchase} />;
  if (purchase.items.length === 0) {
    return (
      <p className="purchase__note">
        {purchase.itemCount > 0
          ? "Esta compra foi feita antes de o app guardar a lista de itens."
          : "Esta compra não tem itens guardados."}
      </p>
    );
  }
  const indexes = purchase.items.map((_item, index) => index);
  const bought = indexes.filter((index) => purchase.items[index].done);
  const left = indexes.filter((index) => !purchase.items[index].done);
  const { cents, priced } = pricedTotal(purchase);

  return (
    <>
      {bought.length > 0 && (
        <>
          <h3 className="purchase__group">Comprados · {bought.length}</h3>
          <ItemLines purchase={purchase} indexes={bought} />
        </>
      )}
      {left.length > 0 && (
        <>
          <h3 className="purchase__group">Estavam na lista sem marcar · {left.length}</h3>
          <ItemLines purchase={purchase} indexes={left} />
        </>
      )}
      {priced > 0 && (
        <p className="purchase__subtotal">
          <span>
            Soma dos preços ({priced} de {purchase.items.length} {purchase.items.length === 1 ? "item" : "itens"})
          </span>
          <strong>{formatMoney(cents)}</strong>
        </p>
      )}
    </>
  );
}
