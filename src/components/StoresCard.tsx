import { useMemo } from "react";
import { formatMonth } from "../domain/history";
import { formatMoney } from "../domain/money";
import { buildPriceIndex } from "../domain/prices";
import { purchaseStore } from "../domain/storeName";
import { priceGaps, storeTotals } from "../domain/stores";
import type { Purchase } from "../domain/types";

interface StoresCardProps {
  purchases: Purchase[];
  month: string;
}

/**
 * Indicativos por mercado (vêm do cupom lido): quanto foi em cada um no mês e
 * em qual o mesmo produto saiu mais barato.
 */
export function StoresCard({ purchases, month }: StoresCardProps) {
  const summary = useMemo(() => storeTotals(purchases, month), [purchases, month]);
  const gaps = useMemo(() => priceGaps(buildPriceIndex(purchases)), [purchases]);
  const anyStore = purchases.some((purchase) => purchaseStore(purchase));

  if (!anyStore) {
    return (
      <p className="hint stores-hint">
        Escreva o mercado ao finalizar a compra (ou leia o cupom) para ver aqui quanto foi em cada um e onde cada
        produto sai mais barato.
      </p>
    );
  }

  const top = summary.stores[0]?.totalCents ?? 0;

  return (
    <section className="card stores" aria-label="Por mercado">
      <h2 className="stores__title">Por mercado · {formatMonth(month)}</h2>
      {summary.stores.length === 0 ? (
        <p className="hint">Nenhuma compra com mercado em {formatMonth(month)}.</p>
      ) : (
        <ul className="stores__list">
          {summary.stores.map((store) => (
            <li key={store.key} className="stores__row">
              <span className="stores__line">
                <span className="stores__name">{store.name}</span>
                <span className="stores__amount">{formatMoney(store.totalCents)}</span>
              </span>
              <span className="stores__bar" aria-hidden="true">
                <span style={{ width: `${Math.max(4, Math.round((store.totalCents / top) * 100))}%` }} />
              </span>
              <span className="stores__meta">
                {store.count === 1 ? "1 compra" : `${store.count} compras`}
                {store.count > 1 && ` · média de ${formatMoney(Math.round(store.totalCents / store.count))}`}
              </span>
            </li>
          ))}
        </ul>
      )}
      {summary.unknown.count > 0 && (
        <p className="hint">
          {summary.unknown.count === 1 ? "1 compra" : `${summary.unknown.count} compras`} sem mercado (
          {formatMoney(summary.unknown.totalCents)}) ficam de fora.
        </p>
      )}

      {gaps.length > 0 && (
        <>
          <h3 className="stores__subtitle">Onde sai mais barato</h3>
          <ul className="stores__gaps">
            {gaps.map((gap) => (
              <li key={gap.text} className="stores__gap">
                <span className="stores__gap-name">{gap.text}</span>
                <span className="stores__gap-detail">
                  <strong>{formatMoney(gap.cheapest.unitCents)}</strong> no {gap.cheapest.store} ·{" "}
                  {formatMoney(gap.priciest.unitCents)} no {gap.priciest.store}
                </span>
                <span className="stores__gap-badge">
                  {formatMoney(gap.priciest.unitCents - gap.cheapest.unitCents)} a menos
                </span>
              </li>
            ))}
          </ul>
          <p className="hint">Compara o último preço pago em cada mercado.</p>
        </>
      )}
    </section>
  );
}
