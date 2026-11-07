import { describePayment, formatMoney, monthTotal } from "../domain/money";
import { formatQuantity, relate } from "../domain/receipt";
import type { Purchase, PurchasedItem } from "../domain/types";
import { Icon } from "../ui/Icon";

interface ExpensesScreenProps {
  purchases: Purchase[];
  onEdit: (purchase: Purchase) => void;
  onReceipt: (purchase: Purchase) => void;
}

const dateFormat = new Intl.DateTimeFormat("pt-BR", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});
const monthFormat = new Intl.DateTimeFormat("pt-BR", { month: "long" });

function ItemLines({ items }: { items: PurchasedItem[] }) {
  return (
    <ul className="purchase__list">
      {items.map((item, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: lista fixa de uma compra passada; nunca muda de ordem.
        <li key={`${item.text}-${index}`}>
          {item.quantity > 1 && <span className="qty">{item.quantity}×</span>}
          <span>{item.text}</span>
        </li>
      ))}
    </ul>
  );
}

/** Com cupom: cada item da lista com o preço pago, o que veio fora da lista e o que faltou. */
function ReceiptItems({ purchase }: { purchase: Purchase }) {
  const receipt = purchase.receipt;
  if (!receipt) return null;
  const { matched, extras, missing } = relate(purchase.items, receipt);

  return (
    <details className="purchase__items">
      <summary>
        {receipt.items.length === 1 ? "Ver o produto do cupom" : `Ver os ${receipt.items.length} produtos do cupom`}
      </summary>
      {matched.length > 0 && (
        <>
          <h3 className="purchase__group">Da lista · {matched.length}</h3>
          <ul className="purchase__list">
            {matched.map(({ index, item, lines, totalCents }) => (
              <li key={index} className="purchase__priced">
                <span className="purchase__priced-name">
                  {item.text}
                  <small>{lines.map((line) => `${line.description} (${formatQuantity(line)})`).join(" + ")}</small>
                </span>
                <span className="purchase__priced-value">{formatMoney(totalCents)}</span>
              </li>
            ))}
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
          <ItemLines items={missing.map(({ item }) => item)} />
        </>
      )}
    </details>
  );
}

/** A lista que estava na compra: o que foi comprado e o que ficou para trás. */
function PurchaseItems({ purchase }: { purchase: Purchase }) {
  if (purchase.receipt && purchase.receipt.items.length > 0) return <ReceiptItems purchase={purchase} />;
  if (purchase.items.length === 0) {
    return purchase.itemCount > 0 ? (
      <p className="purchase__note">Esta compra foi feita antes de o app guardar a lista de itens.</p>
    ) : null;
  }
  const bought = purchase.items.filter((item) => item.done);
  const left = purchase.items.filter((item) => !item.done);

  return (
    <details className="purchase__items">
      <summary>
        {purchase.items.length === 1 ? "Ver o item" : `Ver os ${purchase.items.length} itens`}
      </summary>
      {bought.length > 0 && (
        <>
          <h3 className="purchase__group">Comprados · {bought.length}</h3>
          <ItemLines items={bought} />
        </>
      )}
      {left.length > 0 && (
        <>
          <h3 className="purchase__group">Estavam na lista sem marcar · {left.length}</h3>
          <ItemLines items={left} />
        </>
      )}
    </details>
  );
}

export function ExpensesScreen({ purchases, onEdit, onReceipt }: ExpensesScreenProps) {
  const month = monthTotal(purchases);

  return (
    <div className="page">
      <header className="screen-header">
        <h1 className="title">Gastos</h1>
        <p className="subtitle">As últimas compras finalizadas.</p>
      </header>

      {purchases.length > 0 && (
        <section className="card total" aria-label="Total do mês">
          <span className="total__label">Total de {monthFormat.format(new Date())}</span>
          <span className="total__amount">{formatMoney(month.cents)}</span>
          <span className="total__count">
            {month.count === 1 ? "1 compra" : `${month.count} compras`}
          </span>
        </section>
      )}

      {purchases.length === 0 ? (
        <div className="empty">
          <span className="empty__icon" aria-hidden="true">
            <Icon name="receipt" size={32} />
          </span>
          <h2 className="empty__title">Nenhuma compra ainda</h2>
          <p className="hint">Quando terminar as compras, toque em Finalizar compra no fim da lista.</p>
        </div>
      ) : (
        <ul className="purchases">
          {purchases.map((purchase) => {
            const when = dateFormat.format(new Date(purchase.createdAt));
            const money = formatMoney(purchase.amountCents);
            return (
              <li key={purchase.id} className="purchase">
                <div className="purchase__top">
                  <span className="purchase__amount">{money}</span>
                  <span className="purchase__date">{when}</span>
                </div>
                <span className={`purchase__method method--${purchase.method}`}>
                  {describePayment(purchase)}
                </span>
                <span className="purchase__meta">
                  {purchase.itemCount === 1 ? "1 item" : `${purchase.itemCount} itens`}
                  {purchase.memberName && ` · por ${purchase.memberName}`}
                  {purchase.receipt?.storeName && ` · ${purchase.receipt.storeName}`}
                </span>
                <div className="purchase__bottom">
                  <button
                    type="button"
                    className={purchase.receipt ? "item__edit purchase__receipt--done" : "item__edit"}
                    aria-label={`${purchase.receipt ? "Ver cupom" : "Ler cupom"} da compra de ${money} de ${when}`}
                    onClick={() => onReceipt(purchase)}
                  >
                    <Icon name={purchase.receipt ? "check" : "receipt"} size={18} />
                    {purchase.receipt ? "Cupom" : "Ler cupom"}
                  </button>
                  <button
                    type="button"
                    className="item__edit"
                    aria-label={`Corrigir compra de ${money} de ${when}`}
                    onClick={() => onEdit(purchase)}
                  >
                    <Icon name="edit" size={18} />
                    Corrigir
                  </button>
                </div>
                <PurchaseItems purchase={purchase} />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
