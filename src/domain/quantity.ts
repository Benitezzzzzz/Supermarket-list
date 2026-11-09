/**
 * Quantidade digitada junto com o nome do item, na frente ou no fim:
 * "2 peixe", "2x peixe", "peixe 2x", "peixe x2", "peixe (2)", "peixe 2 un", "peixe - 2 unidades".
 * Número seguido de medida ("2 kg arroz", "Refrigerante 2L") faz parte do nome.
 */

const MAX = 999;

const UNITS = String.raw`(?:un|und|unid|unids|unidade|unidades)\.?`;
const MEASURES = String.raw`(?:kg|g|mg|l|ml|lt|lts|cx|pct|pc|dz)\b`;

const PREFIX = new RegExp(String.raw`^(\d{1,3})\s*(?:[xX×]\s+|${UNITS}\s+|\s)(?!${MEASURES})(\S.*)$`, "i");

const SUFFIX = new RegExp(
  String.raw`^(.*?\p{L}.*?)\s*(?:\s[xX×]\s*(\d{1,3})|\s(\d{1,3})\s*[xX×]|\((\d{1,3})\)|(?:\s[-–]\s*|\s)(\d{1,3})\s*${UNITS})$`,
  "iu",
);

function capitalize(text: string): string {
  return text.replace(/^\p{Ll}/u, (letter) => letter.toUpperCase());
}

function valid(quantity: number): boolean {
  return Number.isInteger(quantity) && quantity >= 1 && quantity <= MAX;
}

/** Separa "peixe 2x" em quantidade 2 e nome "Peixe". Sem número, a quantidade é 1. */
export function parseQuantity(input: string): { text: string; quantity: number } {
  const trimmed = input.trim().replace(/\s+/g, " ");

  const front = trimmed.match(PREFIX);
  if (front && /\p{L}/u.test(front[2])) {
    const quantity = Number(front[1]);
    if (valid(quantity)) return { text: capitalize(front[2].trim()), quantity };
  }

  const back = trimmed.match(SUFFIX);
  if (back) {
    const quantity = Number(back[2] ?? back[3] ?? back[4] ?? back[5]);
    const text = back[1].replace(/\s*[-–]$/, "").trim();
    if (valid(quantity) && text) return { text: capitalize(text), quantity };
  }

  return { text: trimmed, quantity: 1 };
}
