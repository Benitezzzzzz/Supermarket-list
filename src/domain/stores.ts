import { purchaseMonth } from "./history";
import { type PriceIndex, type StorePrice, storePrices } from "./prices";
import { purchaseStore, storeKey } from "./storeName";
import type { Purchase } from "./types";

export { shortStoreName } from "./storeName";

export interface StoreTotal {
  key: string;
  name: string;
  totalCents: number;
  count: number;
}

export interface StoreSummary {
  stores: StoreTotal[];
  /** Compras do período sem mercado (nem digitado, nem do cupom). */
  unknown: { totalCents: number; count: number };
}

/** Quanto foi gasto em cada mercado no mês (AAAA-MM), do que mais gastou ao que menos gastou. */
export function storeTotals(purchases: Purchase[], month: string): StoreSummary {
  const stores = new Map<string, StoreTotal>();
  const unknown = { totalCents: 0, count: 0 };
  for (const purchase of purchases) {
    if (purchaseMonth(purchase) !== month) continue;
    const name = purchaseStore(purchase);
    if (!name) {
      unknown.totalCents += purchase.amountCents;
      unknown.count += 1;
      continue;
    }
    const key = storeKey(name);
    const entry = stores.get(key) ?? { key, name, totalCents: 0, count: 0 };
    entry.totalCents += purchase.amountCents;
    entry.count += 1;
    stores.set(key, entry);
  }
  return { stores: [...stores.values()].sort((a, b) => b.totalCents - a.totalCents), unknown };
}

export interface PriceGap {
  text: string;
  cheapest: StorePrice;
  priciest: StorePrice;
  /** Quanto o mais caro custa a mais que o mais barato, em %. */
  percent: number;
}

/**
 * Produtos comprados em mais de um mercado: o último preço em cada um, o mais barato e o mais caro.
 * Os de maior diferença vêm primeiro.
 */
export function priceGaps(index: PriceIndex, limit = 5): PriceGap[] {
  const gaps: PriceGap[] = [];
  for (const points of index.values()) {
    const prices = storePrices(points);
    if (prices.length < 2) continue;
    const cheapest = prices[0];
    const priciest = prices[prices.length - 1];
    if (priciest.unitCents === cheapest.unitCents) continue;
    gaps.push({
      text: points[0].text,
      cheapest,
      priciest,
      percent: Math.round(((priciest.unitCents - cheapest.unitCents) / cheapest.unitCents) * 100),
    });
  }
  return gaps.sort((a, b) => b.percent - a.percent || a.text.localeCompare(b.text, "pt")).slice(0, limit);
}
