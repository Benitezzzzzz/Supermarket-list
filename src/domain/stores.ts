import { purchaseMonth } from "./history";
import type { PriceIndex } from "./prices";
import type { Purchase } from "./types";

/** Formas jurídicas e palavras genéricas que só alongam o nome do mercado no cupom. */
const LEGAL = /\b(?:ltda|me|epp|eireli|s\/?a|s\.a\.?|cia|comercio|comércio|de|e|alimentos|varejista|atacadista|supermercados?)\b\.?/giu;

/** "RC COMERCIO DE ALIMENTOS LTDA" vira "RC". Se sobrar pouco, fica o nome do cupom. */
export function shortStoreName(name: string): string {
  const clean = name.replace(/\s+/g, " ").trim();
  if (!clean) return "";
  const short = clean.replace(LEGAL, " ").replace(/[-–,.]+/g, " ").replace(/\s+/g, " ").trim();
  const chosen = short.length >= 2 ? short : clean;
  // Siglas curtas ("RC", "GB") ficam em maiúsculas; o resto, só a primeira letra.
  return chosen
    .split(" ")
    .map((word) =>
      word.length <= 2 && word === word.toLocaleUpperCase("pt-BR")
        ? word
        : word.charAt(0).toLocaleUpperCase("pt-BR") + word.slice(1).toLocaleLowerCase("pt-BR"),
    )
    .join(" ");
}

/** Mesmo mercado com o nome escrito de jeitos diferentes: o CNPJ manda; sem ele, o nome curto. */
function storeKey(purchase: Purchase): string | null {
  const receipt = purchase.receipt;
  if (!receipt) return null;
  if (receipt.cnpj) return receipt.cnpj;
  const name = shortStoreName(receipt.storeName);
  return name ? name.toLowerCase() : null;
}

export interface StoreTotal {
  key: string;
  name: string;
  totalCents: number;
  count: number;
}

export interface StoreSummary {
  stores: StoreTotal[];
  /** Compras do período sem cupom lido: não dá para saber o mercado. */
  unknown: { totalCents: number; count: number };
}

/** Quanto foi gasto em cada mercado no mês (AAAA-MM), do que mais gastou ao que menos gastou. */
export function storeTotals(purchases: Purchase[], month: string): StoreSummary {
  const stores = new Map<string, StoreTotal>();
  const unknown = { totalCents: 0, count: 0 };
  for (const purchase of purchases) {
    if (purchaseMonth(purchase) !== month) continue;
    const key = storeKey(purchase);
    if (!key) {
      unknown.totalCents += purchase.amountCents;
      unknown.count += 1;
      continue;
    }
    const entry = stores.get(key) ?? {
      key,
      name: shortStoreName(purchase.receipt?.storeName ?? "") || "Mercado sem nome",
      totalCents: 0,
      count: 0,
    };
    entry.totalCents += purchase.amountCents;
    entry.count += 1;
    stores.set(key, entry);
  }
  return { stores: [...stores.values()].sort((a, b) => b.totalCents - a.totalCents), unknown };
}

export interface StorePrice {
  store: string;
  unitCents: number;
  date: string;
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
    // Os pontos vêm do mais recente ao mais antigo: o primeiro de cada mercado é o último preço lá.
    const latest = new Map<string, StorePrice>();
    for (const point of points) {
      const store = shortStoreName(point.storeName);
      if (!store || point.unitCents <= 0) continue;
      const key = store.toLowerCase();
      if (!latest.has(key)) latest.set(key, { store, unitCents: point.unitCents, date: point.date });
    }
    if (latest.size < 2) continue;
    const prices = [...latest.values()].sort((a, b) => a.unitCents - b.unitCents);
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
