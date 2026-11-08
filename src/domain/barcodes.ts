import { DEFAULT_CATEGORY } from "./categories";
import type { Barcode, Purchase } from "./types";

/**
 * Deixa o código comparável: só dígitos e sem zeros à esquerda. Assim o UPC-A de 12
 * dígitos e o mesmo código lido como EAN-13 ("0" na frente) são o mesmo produto.
 * Devolve null se não parecer um código de produto.
 */
export function normalizeCode(text: string): string | null {
  const digits = text.replace(/\D/g, "").replace(/^0+/, "");
  return digits.length >= 5 && digits.length <= 14 ? digits : null;
}

export interface KnownProduct {
  text: string;
  category: string;
  /** "aprendido": alguém digitou o nome; "cupom": veio de um cupom fiscal lido. */
  source: "aprendido" | "cupom";
}

/** "LEITE UHT ITALAC INT 1L" vira "Leite uht italac int 1l": mais fácil de ler na lista. */
function fromReceiptText(description: string): string {
  const lower = description.trim().toLowerCase().replace(/\s+/g, " ");
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

/**
 * O produto de um código de barras: primeiro o que a lista aprendeu; depois os cupons
 * já lidos (o nome do item da lista ligado à linha do cupom, ou a descrição do cupom).
 */
export function findProduct(code: string, barcodes: Barcode[], purchases: Purchase[]): KnownProduct | null {
  const learned = barcodes.find((barcode) => barcode.code === code);
  if (learned) return { text: learned.text, category: learned.category, source: "aprendido" };

  const ordered = [...purchases].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  for (const purchase of ordered) {
    const typed = purchase.items.find((item) => item.code && normalizeCode(item.code) === code);
    if (typed) return { text: typed.text, category: typed.category, source: "cupom" };
    const line = purchase.receipt?.items.find((item) => item.code && normalizeCode(item.code) === code);
    if (!line) continue;
    const listItem = line.listIndex === null ? undefined : purchase.items[line.listIndex];
    return listItem
      ? { text: listItem.text, category: listItem.category, source: "cupom" }
      : { text: fromReceiptText(line.description), category: DEFAULT_CATEGORY, source: "cupom" };
  }
  return null;
}
