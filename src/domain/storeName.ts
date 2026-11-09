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

/** O mercado da compra: o que a pessoa escreveu ao finalizar ou, sem isso, o do cupom. */
export function purchaseStore(purchase: Pick<Purchase, "store" | "receipt">): string {
  return purchase.store?.trim() || shortStoreName(purchase.receipt?.storeName ?? "");
}

/** "Atacadão" e "atacadao" são o mesmo mercado. */
export function storeKey(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Mercados já usados nesta lista, do mais recente ao mais antigo, para sugerir ao digitar. */
export function knownStores(purchases: Purchase[]): string[] {
  const seen = new Map<string, string>();
  const ordered = [...purchases].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  for (const purchase of ordered) {
    const name = purchaseStore(purchase);
    if (name && !seen.has(storeKey(name))) seen.set(storeKey(name), name);
  }
  return [...seen.values()];
}
