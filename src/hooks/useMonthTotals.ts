import { useEffect, useMemo, useState } from "react";
import { RECENT_PURCHASES } from "../../shared/contract.ts";
import { fetchMonths } from "../data/listsApi";
import { mergeMonths } from "../domain/history";
import type { MonthTotal, Purchase } from "../domain/types";

/**
 * Total por mês. Com menos compras que o limite do snapshot, o aparelho já tem tudo;
 * com mais, os meses antigos vêm do servidor. Sem internet, fica com o que há no aparelho.
 */
export function useMonthTotals(listId: string, purchases: Purchase[]): MonthTotal[] {
  const complete = purchases.length < RECENT_PURCHASES;
  const [server, setServer] = useState<MonthTotal[] | null>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: purchases muda a cada atualização da lista, e o resumo do servidor acompanha.
  useEffect(() => {
    if (complete) return;
    let cancelled = false;
    fetchMonths(listId)
      .then((months) => {
        if (!cancelled) setServer(months);
      })
      .catch(() => {
        // Sem internet: os meses antigos ficam como estão no aparelho.
      });
    return () => {
      cancelled = true;
    };
  }, [listId, complete, purchases]);

  return useMemo(() => mergeMonths(purchases, server, complete), [purchases, server, complete]);
}
