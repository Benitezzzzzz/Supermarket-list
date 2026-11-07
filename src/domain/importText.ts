/**
 * Entende listas coladas, inclusive mensagens copiadas do WhatsApp:
 * data, hora e nome de quem mandou, negrito, emojis, marcadores,
 * vários itens numa linha e quantidade no fim ("Arroz x2").
 */

export interface ParsedEntry {
  /** Texto do item, com a quantidade na frente quando havia ("2 arroz"). */
  text: string;
  category: string;
}

/** Títulos comuns de seção nas listas que a família manda. */
const CATEGORY_ALIASES: Record<string, string> = {
  frutas: "Hortifruti",
  verduras: "Hortifruti",
  legumes: "Hortifruti",
  "frutas e verduras": "Hortifruti",
  "frutas, verduras e legumes": "Hortifruti",
  "verduras e legumes": "Hortifruti",
  feira: "Hortifruti",
  sacolao: "Hortifruti",
  hortifruti: "Hortifruti",
  carnes: "Açougue e Peixaria",
  carne: "Açougue e Peixaria",
  acougue: "Açougue e Peixaria",
  peixaria: "Açougue e Peixaria",
  peixes: "Açougue e Peixaria",
  "carnes e peixes": "Açougue e Peixaria",
  frios: "Laticínios e Frios",
  laticinios: "Laticínios e Frios",
  "frios e laticinios": "Laticínios e Frios",
  higiene: "Higiene e Farmácia",
  farmacia: "Higiene e Farmácia",
  "higiene pessoal": "Higiene e Farmácia",
  limpeza: "Limpeza",
  "produtos de limpeza": "Limpeza",
  bebidas: "Bebidas",
  padaria: "Padaria",
  congelados: "Congelados",
  mercearia: "Mercearia",
  outros: "Outros",
};

/** Títulos que só anunciam a lista e não são item nem categoria. */
const GENERIC_TITLES = new Set([
  "lista",
  "lista de compras",
  "lista do mercado",
  "lista de mercado",
  "lista da feira",
  "compras",
  "mercado",
  "supermercado",
  "itens",
  "faltando",
  "precisa comprar",
  "comprar",
]);

/** Linhas que o WhatsApp põe no lugar de mídia ou mensagem apagada. */
const NOISE = /^<?\s*(midia oculta|media omitted|imagem ocultada|arquivo de midia oculto|esta mensagem foi apagada|mensagem apagada|voce apagou esta mensagem|this message was deleted|encaminhada|mensagem encaminhada|forwarded)\s*>?$/;

/** "[07/11/26, 14:32:10] Elson: ..." ou "[14:32, 07/11/2026] Elson: ..." (copiar mensagens). */
const BRACKET_PREFIX = /^\[(?=[^\]]*\d{1,2}:\d{2})[^\]]{4,40}\]\s*[^:]{1,40}:\s*/;
/** "07/11/2026 14:32 - Elson: ..." (conversa exportada). */
const DASH_PREFIX = /^\d{1,2}[/.]\d{1,2}[/.]\d{2,4},?\s+\d{1,2}:\d{2}(?::\d{2})?\s*-\s*[^:]{1,40}:\s*/;

/** Emojis, marcadores, caixinhas e numeração no começo da linha. */
const EMOJI = String.raw`(?:\p{Extended_Pictographic}|\p{Emoji_Modifier}|\p{Regional_Indicator}|\u{FE0F}|\u{200D}|\u{20E3})`;
const LEADING_EMOJI = new RegExp(String.raw`^${EMOJI}+\s*`, "u");
const LEADING_BULLET = /^(?:[-–—•·*▪◾◽▫►▶➡→>+]|\d{1,3}\s*[.)\-]\s|\[\s*[xX✓✔]?\s*\]|[☐☑✅✔✓❌])\s*/u;

const TRAILING_EMOJI = new RegExp(String.raw`\s*${EMOJI}+$`, "u");

/** Marcas de formatação do WhatsApp: *negrito*, _itálico_, ~riscado~. */
const FORMATTING = /^[*_~]+|[*_~]+$/g;

/** Quantidade no fim: "Arroz x2", "Arroz (2)", "Arroz - 2 un". */
const TRAILING_QUANTITY = /^(.+?)\s*(?:[xX×]\s*(\d{1,3})|\((\d{1,3})\)|[-–]\s*(\d{1,3})\s*(?:un|unid|unidades?)\.?)$/;

export function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

function stripDecoration(line: string): string {
  let current = line.trim();
  // Repete porque é comum combinar marcador, emoji e negrito ("- 🍅 *Tomate* 🥬").
  for (let i = 0; i < 6; i++) {
    const next = current
      .replace(LEADING_EMOJI, "")
      .replace(LEADING_BULLET, "")
      .replace(TRAILING_EMOJI, "")
      .replace(/\s*\(editada\)$|\s*<\s*esta mensagem foi editada\s*>$/i, "")
      .replace(/\s*[.;,]+$/, "")
      .replace(FORMATTING, "")
      .trim();
    if (next === current) break;
    current = next;
  }
  return current;
}

/** Listas do WhatsApp costumam vir em minúsculas: "arroz" entra como "Arroz". */
function capitalize(text: string): string {
  return text.replace(/^\p{Ll}/u,(letter) => letter.toUpperCase());
}

function categoryFor(title: string, categories: string[]): string | null {
  const key = normalize(title);
  const exact = categories.find((category) => normalize(category) === key);
  if (exact) return exact;
  const alias = CATEGORY_ALIASES[key];
  return alias && categories.includes(alias) ? alias : null;
}

/** "Arroz x2" vira "2 Arroz", para a regra de quantidade já existente ler. */
function moveQuantityToFront(text: string): string {
  const match = text.match(TRAILING_QUANTITY);
  if (!match) return text;
  const quantity = match[2] ?? match[3] ?? match[4];
  return `${quantity} ${match[1].trim()}`;
}

/** Vírgula seguida de espaço separa itens ("arroz, feijão"); "1,5 kg" continua junto. */
function splitItems(line: string): string[] {
  return line
    .split(/,\s+|;\s*/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function parseListText(text: string, categories: string[], defaultCategory: string): ParsedEntry[] {
  const entries: ParsedEntry[] = [];
  const seen = new Set<string>();
  let current = defaultCategory;

  for (const rawLine of text.split(/\r?\n/)) {
    const withoutPrefix = rawLine.trim().replace(BRACKET_PREFIX, "").replace(DASH_PREFIX, "");
    if (NOISE.test(normalize(withoutPrefix))) continue;

    const endsWithColon = /:\s*\**\s*$/.test(withoutPrefix);
    const line = stripDecoration(withoutPrefix).replace(/:$/, "").trim();
    if (!line) continue;

    const heading = categoryFor(line, categories);
    if (heading) {
      current = heading;
      continue;
    }
    // "Lista de compras:", "Para a pousada:" e "*Compras do mês*" só anunciam o que vem.
    const boldTitle = new RegExp(String.raw`^(?:${EMOJI}|\s)*\*[^*,]+\*(?:${EMOJI}|\s|:)*$`, "u").test(withoutPrefix);
    if (GENERIC_TITLES.has(normalize(line)) || boldTitle || (endsWithColon && !line.includes(","))) continue;

    for (const part of splitItems(line)) {
      const cleaned = stripDecoration(part);
      if (!cleaned) continue;
      const itemText = capitalize(moveQuantityToFront(cleaned)).slice(0, 80);
      const key = normalize(itemText);
      if (seen.has(key)) continue;
      seen.add(key);
      entries.push({ text: itemText, category: current });
    }
  }
  return entries;
}
