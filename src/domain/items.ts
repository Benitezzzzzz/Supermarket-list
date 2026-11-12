import { DEFAULT_CATEGORY } from "./categories";
import { parseListText } from "./importText";
import { parseQuantity } from "./quantity";
import type { Item } from "./types";

export const MAX_QUANTITY = 999;

export { parseQuantity };

/** Como o item aparece em avisos e listas: sempre com a quantidade, "1× Peixe", "2× Leite". */
export function describeItem(item: { text: string; quantity: number }): string {
  return `${item.quantity}× ${item.text}`;
}

export function createItem(input: string, category: string, createdAt = new Date()): Item {
  return {
    id: crypto.randomUUID(),
    ...parseQuantity(input),
    done: false,
    category: category || DEFAULT_CATEGORY,
    createdAt: createdAt.toISOString(),
  };
}

/**
 * Transforma texto colado em itens, inclusive mensagens copiadas do WhatsApp.
 * Uma linha com o nome de uma categoria vira título e categoriza as seguintes;
 * sem título, a categoria vem de `guess` (o que a lista aprendeu e produtos comuns).
 */
export function parseImport(
  text: string,
  categories: string[],
  defaultCategory: string,
  guess?: (name: string) => string | null,
): Item[] {
  const now = Date.now();
  return parseListText(text, categories, defaultCategory || DEFAULT_CATEGORY, guess).map((entry, index) =>
    // Um milissegundo por item preserva a ordem colada ao ordenar por data.
    createItem(entry.text, entry.category, new Date(now + index)),
  );
}
