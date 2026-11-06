import type { Item } from "./types";

export const CATEGORY_ORDER = [
  "Hortifruti",
  "Padaria",
  "Açougue e Peixaria",
  "Laticínios e Frios",
  "Mercearia",
  "Bebidas",
  "Limpeza",
  "Higiene e Farmácia",
  "Congelados",
  "Outros",
];

export const DEFAULT_CATEGORY = "Outros";

export function knownCategories(customCategories: string[], items: Item[]): string[] {
  const seen = new Map<string, string>();
  for (const category of [...CATEGORY_ORDER, ...customCategories, ...items.map((i) => i.category)]) {
    const key = category.toLowerCase();
    if (!seen.has(key)) seen.set(key, category);
  }
  return [...seen.values()];
}

export interface CategoryGroup {
  category: string;
  items: Item[];
}

/** Categorias padrão na ordem do mercado; as criadas pela família vêm depois, em ordem alfabética. */
export function groupByCategory(items: Item[]): CategoryGroup[] {
  const groups = new Map<string, Item[]>();
  for (const item of items) {
    groups.set(item.category, [...(groups.get(item.category) ?? []), item]);
  }
  const standard = CATEGORY_ORDER.filter((c) => groups.has(c));
  const custom = [...groups.keys()]
    .filter((c) => !CATEGORY_ORDER.includes(c))
    .sort((a, b) => a.localeCompare(b, "pt"));
  return [...standard, ...custom].map((category) => ({ category, items: groups.get(category)! }));
}
