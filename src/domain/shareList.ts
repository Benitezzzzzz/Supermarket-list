import { groupByCategory } from "./categories";
import { describeItem } from "./items";
import type { Item } from "./types";

/**
 * A lista em texto para mandar no WhatsApp, separada por categoria e com a quantidade
 * ("• 2× Peixe"). Vai só o que falta comprar. Colada de volta no app, entra igual.
 */
export function shareText(listName: string, items: Item[]): string {
  const pending = items.filter((item) => !item.done);
  const lines = [`🛒 *Lista ${listName}*`];
  for (const group of groupByCategory(pending)) {
    lines.push("", `*${group.category}*`, ...group.items.map((item) => `• ${describeItem(item)}`));
  }
  return lines.join("\n");
}

/** Abre o compartilhar do celular; sem ele, o WhatsApp Web com o texto pronto. */
export async function shareList(text: string): Promise<void> {
  if (typeof navigator.share === "function") {
    try {
      await navigator.share({ text });
      return;
    } catch (error) {
      // A pessoa fechou o compartilhar: não abre mais nada.
      if (error instanceof DOMException && error.name === "AbortError") return;
    }
  }
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener");
}
