import { productKey } from "./prices";
import type { Item, Template, TemplateItem } from "./types";

/** Modelo novo a partir dos itens (sem marcação nem preço; itens repetidos entram uma vez). */
export function createTemplate(name: string, items: Pick<Item, "text" | "quantity" | "category">[], isDefault = false): Template {
  return {
    id: crypto.randomUUID(),
    name: name.trim(),
    items: uniqueItems(items.map(({ text, quantity, category }) => ({ text, quantity, category }))),
    isDefault,
    updatedAt: new Date().toISOString(),
  };
}

/** Mesmo produto escrito duas vezes ("Leite" e "leites") fica uma vez só, com a maior quantidade. */
export function uniqueItems(items: TemplateItem[]): TemplateItem[] {
  const byKey = new Map<string, TemplateItem>();
  for (const item of items) {
    const key = productKey(item.text);
    const existing = byKey.get(key);
    if (!existing) byKey.set(key, item);
    else if (item.quantity > existing.quantity) byKey.set(key, { ...existing, quantity: item.quantity });
  }
  return [...byKey.values()];
}

/**
 * Itens do modelo prontos para entrar na lista. O que já está na lista fica de fora,
 * para usar o modelo duas vezes não duplicar nada. Nenhum preço vem junto.
 */
export function itemsFromTemplate(template: Template, current: Item[], now = Date.now()): Item[] {
  const present = new Set(current.map((item) => productKey(item.text)));
  return template.items
    .filter((item) => !present.has(productKey(item.text)))
    .map((item, index) => ({
      id: crypto.randomUUID(),
      text: item.text,
      quantity: item.quantity,
      category: item.category,
      done: false,
      // Um milissegundo de diferença mantém a ordem do modelo.
      createdAt: new Date(now + index).toISOString(),
    }));
}

export function defaultTemplate(templates: Template[]): Template | undefined {
  return templates.find((template) => template.isDefault);
}
