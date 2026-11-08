import type { MonthTotal, Purchase } from "./types";

/** "2026-11" no horário do aparelho. */
export function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function purchaseMonth(purchase: Pick<Purchase, "createdAt">): string {
  return monthKey(new Date(purchase.createdAt));
}

/** Total por mês das compras carregadas, do mais recente ao mais antigo. */
export function localMonths(purchases: Purchase[]): MonthTotal[] {
  const byMonth = new Map<string, MonthTotal>();
  for (const purchase of purchases) {
    const month = purchaseMonth(purchase);
    const total = byMonth.get(month) ?? { month, totalCents: 0, count: 0 };
    total.totalCents += purchase.amountCents;
    total.count += 1;
    byMonth.set(month, total);
  }
  return [...byMonth.values()].sort((a, b) => b.month.localeCompare(a.month));
}

/**
 * Junta o que está no aparelho com o resumo do servidor. Os meses mais novos que a compra
 * mais antiga carregada vêm do aparelho (já com o que ainda não foi enviado); o mês dessa
 * compra e os anteriores, que podem estar incompletos aqui, vêm do servidor.
 */
export function mergeMonths(purchases: Purchase[], server: MonthTotal[] | null, complete: boolean): MonthTotal[] {
  const local = localMonths(purchases);
  if (complete || !server || purchases.length === 0) return local;
  const oldest = purchaseMonth(purchases[purchases.length - 1]);
  return [...local.filter((month) => month.month > oldest), ...server.filter((month) => month.month <= oldest)].sort(
    (a, b) => b.month.localeCompare(a.month),
  );
}

/** Os últimos `count` meses até o de referência, do mais antigo ao mais novo; mês sem compra vale zero. */
export function lastMonths(totals: MonthTotal[], count: number, reference = new Date()): MonthTotal[] {
  const byMonth = new Map(totals.map((total) => [total.month, total]));
  const result: MonthTotal[] = [];
  for (let back = count - 1; back >= 0; back--) {
    const month = monthKey(new Date(reference.getFullYear(), reference.getMonth() - back, 1));
    result.push(byMonth.get(month) ?? { month, totalCents: 0, count: 0 });
  }
  return result;
}

export function previousMonthKey(month: string): string {
  const [year, number] = month.split("-").map(Number);
  return monthKey(new Date(year, number - 2, 1));
}

export interface Change {
  diffCents: number;
  /** Variação em porcentagem; null quando a base é zero. */
  percent: number | null;
}

export function compareCents(current: number, previous: number): Change {
  const diffCents = current - previous;
  return { diffCents, percent: previous > 0 ? Math.round((diffCents / previous) * 100) : null };
}

/** A compra imediatamente anterior a esta (a lista vem da mais nova para a mais antiga). */
export function previousPurchase(purchases: Purchase[], id: string): Purchase | undefined {
  const index = purchases.findIndex((purchase) => purchase.id === id);
  return index >= 0 ? purchases[index + 1] : undefined;
}

/** Média das até `count` compras anteriores a esta. */
export function averageBefore(purchases: Purchase[], id: string, count = 5): { cents: number; count: number } | null {
  const index = purchases.findIndex((purchase) => purchase.id === id);
  if (index < 0) return null;
  const before = purchases.slice(index + 1, index + 1 + count);
  if (before.length === 0) return null;
  return {
    cents: Math.round(before.reduce((sum, purchase) => sum + purchase.amountCents, 0) / before.length),
    count: before.length,
  };
}

const monthLong = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" });
const monthShort = new Intl.DateTimeFormat("pt-BR", { month: "short" });
const monthOnly = new Intl.DateTimeFormat("pt-BR", { month: "long" });

function monthDate(month: string): Date {
  const [year, number] = month.split("-").map(Number);
  return new Date(year, number - 1, 15);
}

/** "novembro de 2026". */
export function formatMonth(month: string): string {
  return monthLong.format(monthDate(month));
}

/** "novembro". */
export function formatMonthName(month: string): string {
  return monthOnly.format(monthDate(month));
}

/** "nov". */
export function formatMonthShort(month: string): string {
  return monthShort.format(monthDate(month)).replace(".", "");
}
