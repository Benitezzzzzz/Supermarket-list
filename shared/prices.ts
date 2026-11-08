import type { ItemPrice, PurchasedItem, Template } from "./contract.ts";

/**
 * Aplica preço e marca nas posições indicadas de purchase.items. Posição que não existe
 * é ignorada. Usada no servidor e no aparelho, para os dois chegarem ao mesmo resultado.
 */
export function applyPrices(items: PurchasedItem[], prices: ItemPrice[]): PurchasedItem[] {
  const byIndex = new Map(prices.map((price) => [price.index, price]));
  return items.map((item, index) => {
    const price = byIndex.get(index);
    if (!price) return item;
    const { priceSource: _source, brand: _brand, ...rest } = item;
    const next: PurchasedItem = { ...rest, unitCents: price.unitCents };
    if (price.brand) next.brand = price.brand;
    if (price.unitCents !== null) next.priceSource = price.priceSource ?? "manual";
    if (price.code !== undefined) next.code = price.code;
    return next;
  });
}

/** Grava um modelo na coleção: substitui pelo id e, se ele for o padrão, tira a marca dos outros. */
export function putTemplate(templates: Template[], template: Template): Template[] {
  const others = templates
    .filter((existing) => existing.id !== template.id)
    .map((existing) => (template.isDefault && existing.isDefault ? { ...existing, isDefault: false } : existing));
  return [...others, template].sort(
    (a, b) => a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" }) || a.id.localeCompare(b.id),
  );
}
