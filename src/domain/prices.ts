import { parseMoney } from "./money";
import { relate, words } from "./receipt";
import type { PriceSource, Purchase } from "./types";

/** Nome do produto sem acento, plural, unidade e palavras de ligação: "2 Leites" e "leite" são o mesmo. */
export function productKey(text: string): string {
  const key = words(text).join(" ");
  return key || text.trim().toLowerCase();
}

export interface ItemPriceInfo {
  unitCents: number;
  totalCents: number;
  source: PriceSource;
}

/** Preço que o cupom fiscal dá ao item (pelas linhas ligadas a ele), sem olhar o digitado. */
export function receiptPrice(purchase: Purchase, index: number): ItemPriceInfo | null {
  const item = purchase.items[index];
  if (!item || !purchase.receipt) return null;
  const lines = purchase.receipt.items.filter((line) => line.listIndex === index);
  if (lines.length === 0) return null;
  const totalCents = lines.reduce((sum, line) => sum + line.totalCents, 0);
  const unitCents = lines.length === 1 ? lines[0].unitCents : Math.round(totalCents / item.quantity);
  return { unitCents, totalCents, source: "cupom" };
}

/**
 * Preço de um item da compra: o digitado vale mais; sem ele, o das linhas do cupom
 * ligadas ao item. null quando ainda não há preço.
 */
export function itemPrice(purchase: Purchase, index: number): ItemPriceInfo | null {
  const item = purchase.items[index];
  if (!item) return null;
  if (item.unitCents !== undefined && item.unitCents !== null) {
    return { unitCents: item.unitCents, totalCents: item.unitCents * item.quantity, source: item.priceSource ?? "manual" };
  }
  return receiptPrice(purchase, index);
}

/** Preço digitado: "" é sem preço (null), "0" vale zero (brinde), texto inválido é undefined. */
export function parsePrice(text: string): number | null | undefined {
  const typed = text.trim();
  if (!typed) return null;
  if (/^0+([.,]0{1,2})?$/.test(typed)) return 0;
  return parseMoney(typed) ?? undefined;
}

/** Soma dos preços dos itens que têm preço, e quantos são. */
export function pricedTotal(purchase: Purchase): { cents: number; priced: number } {
  let cents = 0;
  let priced = 0;
  purchase.items.forEach((_item, index) => {
    const price = itemPrice(purchase, index);
    if (price) {
      cents += price.totalCents;
      priced += 1;
    }
  });
  // Produtos do cupom que vieram fora da lista também foram pagos.
  if (purchase.receipt) cents += relate(purchase.items, purchase.receipt).extras.reduce((sum, line) => sum + line.totalCents, 0);
  return { cents, priced };
}

export interface PricePoint {
  key: string;
  text: string;
  brand: string;
  quantity: number;
  unitCents: number;
  totalCents: number;
  /** Data da compra (ISO). */
  date: string;
  purchaseId: string;
  storeName: string;
  source: PriceSource;
}

export type PriceIndex = Map<string, PricePoint[]>;

/** Todos os preços conhecidos, agrupados por produto, do mais recente ao mais antigo. */
export function buildPriceIndex(purchases: Purchase[]): PriceIndex {
  const index: PriceIndex = new Map();
  const ordered = [...purchases].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  for (const purchase of ordered) {
    purchase.items.forEach((item, position) => {
      const price = itemPrice(purchase, position);
      if (!price) return;
      const key = productKey(item.text);
      const points = index.get(key) ?? [];
      points.push({
        key,
        text: item.text,
        brand: item.brand?.trim() ?? "",
        quantity: item.quantity,
        unitCents: price.unitCents,
        totalCents: price.totalCents,
        date: purchase.createdAt,
        purchaseId: purchase.id,
        storeName: purchase.receipt?.storeName ?? "",
        source: price.source,
      });
      index.set(key, points);
    });
  }
  return index;
}

/** Histórico de um produto pelo nome, como a pessoa escreveu. */
export function pricesFor(index: PriceIndex, text: string): PricePoint[] {
  return index.get(productKey(text)) ?? [];
}

/** A última compra deste produto, com preço, marca e data. */
export function lastPrice(index: PriceIndex, text: string, excludePurchaseId?: string): PricePoint | undefined {
  return pricesFor(index, text).find((point) => point.purchaseId !== excludePurchaseId);
}

export interface BrandSummary {
  brand: string;
  count: number;
  lastUnitCents: number;
  lastDate: string;
  minUnitCents: number;
  avgUnitCents: number;
}

/** Uma linha por marca, da mais barata (pela média) para a mais cara. Sem marca vira "". */
export function brandSummary(points: PricePoint[]): BrandSummary[] {
  const byBrand = new Map<string, PricePoint[]>();
  for (const point of points) {
    const brand = point.brand.toLowerCase();
    byBrand.set(brand, [...(byBrand.get(brand) ?? []), point]);
  }
  return [...byBrand.values()]
    .map((group) => ({
      brand: group[0].brand,
      count: group.length,
      lastUnitCents: group[0].unitCents,
      lastDate: group[0].date,
      minUnitCents: Math.min(...group.map((point) => point.unitCents)),
      avgUnitCents: Math.round(group.reduce((sum, point) => sum + point.unitCents, 0) / group.length),
    }))
    .sort((a, b) => a.avgUnitCents - b.avgUnitCents || a.brand.localeCompare(b.brand));
}

/** Marcas já usadas para este produto, para sugerir ao digitar. */
export function knownBrands(points: PricePoint[]): string[] {
  const seen = new Map<string, string>();
  for (const point of points) {
    if (point.brand && !seen.has(point.brand.toLowerCase())) seen.set(point.brand.toLowerCase(), point.brand);
  }
  return [...seen.values()];
}
