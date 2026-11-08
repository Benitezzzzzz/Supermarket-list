import { formatMonth, formatMonthShort } from "../domain/history";
import { formatMoney } from "../domain/money";
import type { MonthTotal } from "../domain/types";

interface MonthChartProps {
  months: MonthTotal[];
  selected: string;
  onSelect: (month: string) => void;
}

function describe(month: MonthTotal): string {
  const count = month.count === 1 ? "1 compra" : `${month.count} compras`;
  return `${formatMonth(month.month)}: ${formatMoney(month.totalCents)}, ${count}`;
}

/**
 * Barras dos últimos meses (uma série só, sem legenda). Cada barra é um botão que escolhe o mês;
 * só o mês escolhido mostra o valor em cima. A tabela logo abaixo traz todos os números.
 */
export function MonthChart({ months, selected, onSelect }: MonthChartProps) {
  const max = Math.max(...months.map((month) => month.totalCents), 1);

  return (
    <figure className="month-chart">
      <fieldset className="month-chart__plot">
        <legend className="visually-hidden">Gasto por mês. Toque num mês para ver as compras dele.</legend>
        {months.map((month) => {
          const isSelected = month.month === selected;
          const height = month.totalCents === 0 ? 0 : Math.max(4, Math.round((month.totalCents / max) * 100));
          return (
            <button
              key={month.month}
              type="button"
              className={isSelected ? "month-chart__col month-chart__col--selected" : "month-chart__col"}
              aria-pressed={isSelected}
              aria-label={describe(month)}
              title={describe(month)}
              onClick={() => onSelect(month.month)}
            >
              <span className="month-chart__value" aria-hidden="true">
                {isSelected && month.totalCents > 0 ? formatMoney(month.totalCents).replace(/,\d{2}$/, "") : ""}
              </span>
              <span className="month-chart__track" aria-hidden="true">
                <span className="month-chart__bar" style={{ height: `${height}%` }} />
              </span>
              <span className="month-chart__label" aria-hidden="true">
                {formatMonthShort(month.month)}
              </span>
            </button>
          );
        })}
      </fieldset>
      <details className="month-chart__table">
        <summary>Ver os valores em tabela</summary>
        <table>
          <thead>
            <tr>
              <th scope="col">Mês</th>
              <th scope="col">Compras</th>
              <th scope="col">Total</th>
            </tr>
          </thead>
          <tbody>
            {[...months].reverse().map((month) => (
              <tr key={month.month}>
                <th scope="row">{formatMonth(month.month)}</th>
                <td>{month.count}</td>
                <td>{formatMoney(month.totalCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
