import { useMemo, useState } from "react";
import { RECENT_PURCHASES } from "../../shared/contract.ts";
import {
  averageBefore,
  compareCents,
  formatMonth,
  formatMonthName,
  lastMonths,
  monthKey,
  previousMonthKey,
  previousPurchase,
  purchaseMonth,
} from "../domain/history";
import { describePayment, formatMoney } from "../domain/money";
import type { MonthTotal, Purchase } from "../domain/types";
import { useMonthTotals } from "../hooks/useMonthTotals";
import { Icon } from "../ui/Icon";
import { ChangeText } from "./ChangeText";
import { MonthChart } from "./MonthChart";
import { PurchaseDetails } from "./PurchaseDetails";
import { PurchaseReport } from "./PurchaseReport";
import { StoresCard } from "./StoresCard";

interface ExpensesScreenProps {
  purchases: Purchase[];
  listId: string;
  listName: string;
  onEdit: (purchase: Purchase) => void;
  onPrices: (purchase: Purchase) => void;
  onDelete: (purchase: Purchase) => void;
  onReceipt: (purchase: Purchase) => void;
}

const CHART_MONTHS = 6;

const dateFormat = new Intl.DateTimeFormat("pt-BR", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});
const dayFormat = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short" });

function MonthSummary({ months, month }: { months: MonthTotal[]; month: string }) {
  const current = months.find((total) => total.month === month) ?? { month, totalCents: 0, count: 0 };
  const previousKey = previousMonthKey(month);
  const previous = months.find((total) => total.month === previousKey);
  const average = current.count > 0 ? Math.round(current.totalCents / current.count) : 0;

  return (
    <section className="card total" aria-label={`Total de ${formatMonth(month)}`}>
      <span className="total__label">Total de {formatMonth(month)}</span>
      <span className="total__amount">{formatMoney(current.totalCents)}</span>
      <span className="total__count">
        {current.count === 1 ? "1 compra" : `${current.count} compras`}
        {current.count > 1 && ` · média de ${formatMoney(average)}`}
      </span>
      {previous && previous.totalCents > 0 && (
        <ChangeText
          change={compareCents(current.totalCents, previous.totalCents)}
          against={`que ${formatMonthName(previousKey)}`}
        />
      )}
    </section>
  );
}

/** Esta compra comparada com a anterior e com a média das últimas. */
function PurchaseComparison({ purchases, purchase }: { purchases: Purchase[]; purchase: Purchase }) {
  const previous = previousPurchase(purchases, purchase.id);
  const average = averageBefore(purchases, purchase.id);
  if (!previous) return null;
  return (
    <div className="purchase__compare">
      <ChangeText
        change={compareCents(purchase.amountCents, previous.amountCents)}
        against={`que a compra de ${dayFormat.format(new Date(previous.createdAt))}`}
      />
      {average && average.count > 1 && (
        <ChangeText
          change={compareCents(purchase.amountCents, average.cents)}
          against={`que a média das ${average.count} anteriores`}
        />
      )}
    </div>
  );
}

interface PurchaseCardProps {
  purchase: Purchase;
  purchases: Purchase[];
  open: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onPrices: () => void;
  onDelete: () => void;
  onReceipt: () => void;
  onPdf: () => void;
}

/** Toque no card abre (com animação) a lista inteira da compra e as ações dela. */
function PurchaseCard({
  purchase,
  purchases,
  open,
  onToggle,
  onEdit,
  onPrices,
  onDelete,
  onReceipt,
  onPdf,
}: PurchaseCardProps) {
  const when = dateFormat.format(new Date(purchase.createdAt));
  const money = formatMoney(purchase.amountCents);
  const panelId = `compra-${purchase.id}`;

  return (
    <li className={open ? "purchase purchase--open" : "purchase"}>
      <button
        type="button"
        className="purchase__head"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={`Compra de ${money} de ${when}`}
        onClick={onToggle}
      >
        <span className="purchase__top">
          <span className="purchase__amount">{money}</span>
          <span className="purchase__date">{when}</span>
        </span>
        <span className="purchase__row">
          <span className={`purchase__method method--${purchase.method}`}>{describePayment(purchase)}</span>
          {purchase.receipt && (
            <span className="purchase__badge">
              <Icon name="check" size={16} />
              Cupom
            </span>
          )}
          <span className="purchase__chevron" aria-hidden="true">
            <Icon name="chevron" size={22} />
          </span>
        </span>
        <span className="purchase__meta">
          {purchase.itemCount === 1 ? "1 item" : `${purchase.itemCount} itens`}
          {purchase.memberName && ` · por ${purchase.memberName}`}
          {purchase.receipt?.storeName && ` · ${purchase.receipt.storeName}`}
        </span>
      </button>

      {/* A grade de 0fr a 1fr anima a altura sem precisar medir o conteúdo. */}
      <div id={panelId} className="purchase__panel" inert={!open} aria-hidden={!open}>
        <div className="purchase__panel-inner">
          <div className="purchase__details">
            <PurchaseComparison purchases={purchases} purchase={purchase} />
            <PurchaseDetails purchase={purchase} />
          </div>
          <div className="purchase__actions">
            <button
              type="button"
              className={purchase.receipt ? "item__edit purchase__receipt--done" : "item__edit"}
              aria-label={`${purchase.receipt ? "Ver cupom" : "Ler cupom"} da compra de ${money} de ${when}`}
              onClick={onReceipt}
            >
              <Icon name={purchase.receipt ? "check" : "receipt"} size={18} />
              {purchase.receipt ? "Cupom" : "Ler cupom"}
            </button>
            {purchase.items.length > 0 && (
              <button
                type="button"
                className="item__edit"
                aria-label={`Preços e marcas da compra de ${money} de ${when}`}
                onClick={onPrices}
              >
                <Icon name="tag" size={18} />
                Preços
              </button>
            )}
            <button
              type="button"
              className="item__edit"
              aria-label={`Gerar PDF da compra de ${money} de ${when}`}
              onClick={onPdf}
            >
              <Icon name="download" size={18} />
              PDF
            </button>
            <button
              type="button"
              className="item__edit"
              aria-label={`Editar compra de ${money} de ${when}`}
              onClick={onEdit}
            >
              <Icon name="edit" size={18} />
              Editar
            </button>
            <button
              type="button"
              className="item__edit purchase__delete"
              aria-label={`Excluir compra de ${money} de ${when}`}
              onClick={onDelete}
            >
              <Icon name="trash" size={18} />
              Excluir
            </button>
          </div>
        </div>
      </div>
    </li>
  );
}

export function ExpensesScreen({
  purchases,
  listId,
  listName,
  onEdit,
  onPrices,
  onDelete,
  onReceipt,
}: ExpensesScreenProps) {
  const months = useMonthTotals(listId, purchases);
  const thisMonth = monthKey(new Date());
  const [selected, setSelected] = useState(thisMonth);
  /** Com um mês escolhido no gráfico, a lista mostra só as compras dele. */
  const [filtered, setFiltered] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  // O contador remonta o relatório quando a mesma compra é pedida de novo.
  const [printing, setPrinting] = useState<{ purchase: Purchase; run: number } | null>(null);

  const chart = useMemo(() => lastMonths(months, CHART_MONTHS), [months]);
  const groups = useMemo(() => {
    const visible = filtered ? purchases.filter((purchase) => purchaseMonth(purchase) === selected) : purchases;
    const byMonth = new Map<string, Purchase[]>();
    for (const purchase of visible) {
      const month = purchaseMonth(purchase);
      byMonth.set(month, [...(byMonth.get(month) ?? []), purchase]);
    }
    return [...byMonth.entries()];
  }, [purchases, filtered, selected]);
  const totals = new Map(months.map((month) => [month.month, month]));
  const truncated = purchases.length >= RECENT_PURCHASES;

  return (
    <div className="page">
      <header className="screen-header">
        <h1 className="title">Gastos</h1>
        <p className="subtitle">Toque numa compra para ver tudo o que veio nela.</p>
      </header>

      {purchases.length > 0 && (
        <>
          <MonthSummary months={months} month={selected} />
          <MonthChart
            months={chart}
            selected={selected}
            onSelect={(month) => {
              setSelected(month);
              setFiltered(true);
            }}
          />
          <StoresCard purchases={purchases} month={selected} />
        </>
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
        <>
          {filtered && (
            <div className="history-filter">
              <span>Compras de {formatMonth(selected)}</span>
              <button type="button" className="btn btn--link" onClick={() => setFiltered(false)}>
                Ver todas
              </button>
            </div>
          )}
          {groups.length === 0 && <p className="hint">Nenhuma compra em {formatMonth(selected)}.</p>}
          {groups.map(([month, list]) => {
            const total = totals.get(month);
            return (
              <section key={month} className="history-month" aria-label={`Compras de ${formatMonth(month)}`}>
                <h2 className="history-month__title">
                  <span className="history-month__name">{formatMonth(month)}</span>
                  {total && (
                    <span className="history-month__total">
                      {formatMoney(total.totalCents)} · {total.count === 1 ? "1 compra" : `${total.count} compras`}
                    </span>
                  )}
                </h2>
                <ul className="purchases">
                  {list.map((purchase) => (
                    <PurchaseCard
                      key={purchase.id}
                      purchase={purchase}
                      purchases={purchases}
                      open={openId === purchase.id}
                      onToggle={() => setOpenId((current) => (current === purchase.id ? null : purchase.id))}
                      onEdit={() => onEdit(purchase)}
                      onPrices={() => onPrices(purchase)}
                      onDelete={() => onDelete(purchase)}
                      onReceipt={() => onReceipt(purchase)}
                      onPdf={() => setPrinting((current) => ({ purchase, run: (current?.run ?? 0) + 1 }))}
                    />
                  ))}
                </ul>
              </section>
            );
          })}
          {truncated && (
            <p className="hint">
              Aqui aparecem as {RECENT_PURCHASES} compras mais recentes. Os totais por mês contam todas.
            </p>
          )}
        </>
      )}

      {printing && (
        <PurchaseReport
          key={printing.run}
          purchase={printing.purchase}
          listName={listName}
          onDone={() => setPrinting(null)}
        />
      )}
    </div>
  );
}
