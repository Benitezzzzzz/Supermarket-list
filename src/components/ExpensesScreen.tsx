import { describePayment, formatMoney, monthTotal } from "../domain/money";
import type { Purchase } from "../domain/types";
import { Icon } from "../ui/Icon";

interface ExpensesScreenProps {
  purchases: Purchase[];
  onEdit: (purchase: Purchase) => void;
}

const dateFormat = new Intl.DateTimeFormat("pt-BR", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});
const monthFormat = new Intl.DateTimeFormat("pt-BR", { month: "long" });

export function ExpensesScreen({ purchases, onEdit }: ExpensesScreenProps) {
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
          {purchases.map((purchase) => (
            <li key={purchase.id} className="purchase">
              <div className="purchase__top">
                <span className="purchase__amount">{formatMoney(purchase.amountCents)}</span>
                <span className="purchase__date">{dateFormat.format(new Date(purchase.createdAt))}</span>
              </div>
              <span className={`purchase__method method--${purchase.method}`}>
                {describePayment(purchase)}
              </span>
              <div className="purchase__bottom">
                <span className="purchase__meta">
                  {purchase.itemCount === 1 ? "1 item" : `${purchase.itemCount} itens`}
                  {purchase.memberName && ` · por ${purchase.memberName}`}
                </span>
                <button
                  type="button"
                  className="item__edit"
                  aria-label={`Corrigir compra de ${formatMoney(purchase.amountCents)} de ${dateFormat.format(new Date(purchase.createdAt))}`}
                  onClick={() => onEdit(purchase)}
                >
                  <Icon name="edit" size={18} />
                  Corrigir
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
