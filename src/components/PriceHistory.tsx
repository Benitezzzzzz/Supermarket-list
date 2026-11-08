import { compareCents } from "../domain/history";
import { formatMoney } from "../domain/money";
import { brandSummary, type PricePoint } from "../domain/prices";
import { ChangeText } from "./ChangeText";

const dayFormat = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short", year: "2-digit" });
const RECENT = 6;

/** Uma linha curta com a última compra: "R$ 6,49 cada · Italac · 12 de out." */
export function describeLast(point: PricePoint): string {
  const parts = [`${formatMoney(point.unitCents)}${point.quantity > 1 ? " cada" : ""}`];
  if (point.brand) parts.push(point.brand);
  parts.push(dayFormat.format(new Date(point.date)));
  return parts.join(" · ");
}

/** Histórico de preços de um produto: última compra, variação, marcas e compras anteriores. */
export function PriceHistory({ points }: { points: PricePoint[] }) {
  if (points.length === 0) {
    return <p className="hint">Ainda não há preço deste produto. Ele aparece aqui depois que você anotar o preço numa compra.</p>;
  }
  const [last, previous] = points;
  const brands = brandSummary(points);
  const withBrand = brands.filter((brand) => brand.brand);

  return (
    <div className="price-history">
      <p className="price-history__last">
        <span className="field-label field-label--small">Última compra</span>
        <strong>{describeLast(last)}</strong>
        {last.storeName && <small>{last.storeName}</small>}
      </p>
      {previous && (
        <ChangeText
          change={compareCents(last.unitCents, previous.unitCents)}
          against={`que em ${dayFormat.format(new Date(previous.date))}`}
        />
      )}

      {withBrand.length > 1 && (
        <table className="price-table">
          <caption>Comparação entre marcas (preço de cada)</caption>
          <thead>
            <tr>
              <th scope="col">Marca</th>
              <th scope="col">Média</th>
              <th scope="col">Menor</th>
              <th scope="col">Última</th>
            </tr>
          </thead>
          <tbody>
            {brands.map((brand, index) => (
              <tr key={brand.brand || "sem-marca"}>
                <th scope="row">
                  {brand.brand || "Sem marca"}
                  {index === 0 && <span className="price-table__best"> · mais barata</span>}
                  <small>{brand.count === 1 ? "1 compra" : `${brand.count} compras`}</small>
                </th>
                <td>{formatMoney(brand.avgUnitCents)}</td>
                <td>{formatMoney(brand.minUnitCents)}</td>
                <td>{formatMoney(brand.lastUnitCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {points.length > 1 && (
        <>
          <h3 className="purchase__group">Compras anteriores</h3>
          <ul className="purchase__list">
            {points.slice(0, RECENT).map((point, index) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: histórico fixo; a mesma compra pode ter o produto duas vezes.
              <li key={`${point.purchaseId}-${index}`} className="purchase__priced">
                <span className="purchase__priced-name">
                  {dayFormat.format(new Date(point.date))}
                  <small>
                    {[point.brand, point.quantity > 1 ? `${point.quantity} unidades` : "", point.source === "cupom" ? "pelo cupom" : ""]
                      .filter(Boolean)
                      .join(" · ")}
                  </small>
                </span>
                <span className="purchase__priced-value">{formatMoney(point.unitCents)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
