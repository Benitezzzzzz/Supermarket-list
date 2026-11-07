import { DEFAULT_CATEGORY } from "./categories";
import { parseListText } from "./importText";
import type { Item } from "./types";

export const MAX_QUANTITY = 999;

/** Número seguido de unidade ("2 kg arroz") faz parte do nome, não é quantidade de itens. */
const QUANTITY_PREFIX = /^(\d{1,3})\s*[xX×]?\s+(?!(?:kg|g|mg|l|ml|un|cx|pct)\b)(.+)$/i;

/** Separa "2 frangos" em quantidade 2 e nome "Frangos". */
export function parseQuantity(input: string): { text: string; quantity: number } {
  const match = input.trim().match(QUANTITY_PREFIX);
  const quantity = match ? Number(match[1]) : 0;
  if (!match || quantity < 1) return { text: input.trim(), quantity: 1 };
  const text = match[2].trim();
  return { text: text[0].toUpperCase() + text.slice(1), quantity };
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
 * Uma linha com o nome de uma categoria vira título e categoriza as seguintes.
 */
export function parseImport(text: string, categories: string[], defaultCategory: string): Item[] {
  const now = Date.now();
  return parseListText(text, categories, defaultCategory || DEFAULT_CATEGORY).map((entry, index) =>
    // Um milissegundo por item preserva a ordem colada ao ordenar por data.
    createItem(entry.text, entry.category, new Date(now + index)),
  );
}
