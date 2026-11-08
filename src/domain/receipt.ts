import type { PurchasedItem, Receipt, ReceiptItem, ReceiptReading } from "./types";

/* ---------- QR code da NFC-e ---------- */

export interface NfceQr {
  accessKey: string;
  /** Código IBGE do estado (25 = Paraíba). */
  state: string;
  cnpj: string;
  /** Ano e mês da emissão, AAAA-MM (vêm na chave). */
  yearMonth: string;
  series: string;
  number: string;
  /** Só o QR de nota emitida em contingência traz o dia e o valor. */
  issuedOn: string | null;
  totalCents: number | null;
  /** Página da Sefaz para conferir a nota (com captcha, aberta pela pessoa). */
  sefazUrl: string;
}

const PARAIBA = "25";
const SEFAZ_PB = "https://www4.sefaz.pb.gov.br/atf/seg/SEGf_AcessarFuncao.jsp?cdFuncao=FIS_1410&p=";

/** Dígito verificador da chave de acesso (módulo 11). */
function validKey(key: string): boolean {
  if (!/^\d{44}$/.test(key)) return false;
  let sum = 0;
  let weight = 2;
  for (let i = 42; i >= 0; i--) {
    sum += Number(key[i]) * weight;
    weight = weight === 9 ? 2 : weight + 1;
  }
  const rest = sum % 11;
  const digit = rest < 2 ? 0 : 11 - rest;
  return digit === Number(key[43]);
}

/**
 * Lê o texto do QR code de uma NFC-e: a URL da Sefaz com ?p=chave|versão|...
 * ou só a chave de 44 dígitos. Devolve null se não for uma NFC-e.
 */
export function parseNfceQr(text: string): NfceQr | null {
  const trimmed = text.trim();
  let payload = trimmed.replace(/\s/g, "");
  const param = trimmed.match(/[?&]p=([^&#\s]+)/i);
  if (param) {
    try {
      payload = decodeURIComponent(param[1]);
    } catch {
      payload = param[1];
    }
  }
  const parts = payload.split("|");
  const accessKey = parts[0];
  // Modelo 65 é a NFC-e; 55 é a NF-e comum.
  if (!validKey(accessKey) || !["65", "55"].includes(accessKey.slice(20, 22))) return null;

  const year = `20${accessKey.slice(2, 4)}`;
  const month = accessKey.slice(4, 6);
  let issuedOn: string | null = null;
  let totalCents: number | null = null;
  // Contingência (tipo de emissão 9): chave|versão|ambiente|dia|valor|...
  if (accessKey[34] === "9" && parts.length >= 5) {
    const day = Number(parts[3]);
    if (day >= 1 && day <= 31) issuedOn = `${year}-${month}-${String(day).padStart(2, "0")}`;
    const value = Number(parts[4]);
    if (Number.isFinite(value) && value > 0) totalCents = Math.round(value * 100);
  }

  const state = accessKey.slice(0, 2);
  const sefazUrl =
    state === PARAIBA ? `${SEFAZ_PB}${encodeURIComponent(payload)}` : /^https?:\/\//i.test(trimmed) ? trimmed : "";
  return {
    accessKey,
    state,
    cnpj: accessKey.slice(6, 20),
    yearMonth: `${year}-${month}`,
    series: accessKey.slice(22, 25),
    number: String(Number(accessKey.slice(25, 34))),
    issuedOn,
    totalCents,
    sefazUrl,
  };
}

export function formatCnpj(cnpj: string): string {
  return cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}

/* ---------- Ligação entre a lista e o cupom ---------- */

const STOPWORDS = new Set(["de", "da", "do", "das", "dos", "e", "com", "sem", "c", "p", "para", "tipo", "tp", "a", "o"]);
const UNITS = /^(\d+([.,]\d+)?(g|gr|kg|mg|ml|l|lt|lts|un|und|unid|cx|pct|pc|m|cm|x)?|kg|g|gr|ml|l|lt|un|und|unid|cx|pct|pc)$/;

/** Abreviações comuns nos cupons de supermercado. */
const ABBREVIATIONS: Record<string, string[]> = {
  lte: ["leite"],
  leit: ["leite"],
  refrig: ["refrigerante"],
  refri: ["refrigerante"],
  ref: ["refrigerante"],
  sab: ["sabao", "sabonete"],
  sabon: ["sabonete"],
  det: ["detergente"],
  deterg: ["detergente"],
  pap: ["papel"],
  hig: ["higienico"],
  cr: ["creme"],
  qj: ["queijo"],
  qjo: ["queijo"],
  queij: ["queijo"],
  mus: ["mussarela", "mucarela"],
  muss: ["mussarela", "mucarela"],
  mucar: ["mucarela", "mussarela"],
  pres: ["presunto"],
  marg: ["margarina"],
  iog: ["iogurte"],
  iogur: ["iogurte"],
  req: ["requeijao"],
  feij: ["feijao"],
  mac: ["macarrao"],
  macarr: ["macarrao"],
  bisc: ["biscoito", "bolacha"],
  biscoit: ["biscoito", "bolacha"],
  cerv: ["cerveja"],
  amac: ["amaciante"],
  desinf: ["desinfetante"],
  sanit: ["sanitaria"],
  agua: ["agua"],
  ext: ["extrato"],
  tom: ["tomate"],
  acuc: ["acucar"],
  choc: ["chocolate"],
  achoc: ["achocolatado"],
  fgo: ["frango"],
  frgo: ["frango"],
  peit: ["peito"],
  bat: ["batata"],
  ceb: ["cebola"],
  maion: ["maionese"],
  mol: ["molho"],
  sard: ["sardinha"],
  salsic: ["salsicha"],
  ling: ["linguica"],
  pao: ["pao"],
  pzza: ["pizza"],
  azeit: ["azeite"],
  vinag: ["vinagre"],
  fil: ["file"],
  cx: [],
};

/** Plural e acento não importam: "Maçãs" e "MACA" são a mesma palavra. */
function stem(word: string): string {
  if (word.length <= 3) return word;
  return word
    .replace(/oes$|aes$/, "ao")
    .replace(/ns$/, "m")
    .replace(/(?<=[aeiou])s$/, "")
    .replace(/res$/, "r");
}

export function words(text: string): string[] {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9.,]+/g, " ")
    .split(" ")
    .map((word) => word.replace(/^[.,]+|[.,]+$/g, ""))
    .filter((word) => word && !STOPWORDS.has(word) && !UNITS.test(word))
    .map(stem);
}

/** Quantas letras trocar, tirar ou pôr para ir de uma palavra à outra. */
function editDistance(a: string, b: string): number {
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    previous = current;
  }
  return previous[b.length];
}

function wordScore(listWord: string, receiptWord: string): number {
  if (listWord === receiptWord) return 1;
  if (ABBREVIATIONS[receiptWord]?.some((full) => stem(full) === listWord)) return 1;
  // "FRANG" → frango, "BISCOIT" → biscoito.
  if (receiptWord.length >= 3 && listWord.startsWith(receiptWord)) return 0.9;
  if (listWord.length >= 4 && receiptWord.startsWith(listWord)) return 0.9;
  // Erro de leitura do cupom amassado: "ANEDOIIH" ainda é amendoim. Só em palavras
  // longas, para "leite" não virar "lente".
  if (listWord.length >= 6 && receiptWord.length >= 5) {
    const a = ocrSkeleton(listWord);
    const b = ocrSkeleton(receiptWord);
    const similarity = 1 - editDistance(a, b) / Math.max(a.length, b.length);
    if (similarity >= 0.7) return similarity * 0.9;
  }
  return 0;
}

/** Letras que a leitura de foto costuma confundir viram a mesma. */
function ocrSkeleton(word: string): string {
  return word.replace(/rn/g, "n").replace(/[mh]/g, "n").replace(/[l1]/g, "i").replace(/0/g, "o");
}

/** Quanto do nome do item da lista aparece na linha do cupom (0 a 1). */
export function matchScore(listText: string, receiptDescription: string): number {
  const listWords = words(listText);
  const receiptWords = words(receiptDescription);
  if (listWords.length === 0 || receiptWords.length === 0) return 0;
  let total = 0;
  for (const listWord of listWords) {
    total += Math.max(...receiptWords.map((receiptWord) => wordScore(listWord, receiptWord)));
  }
  const score = total / listWords.length;
  // O produto costuma vir na primeira palavra do cupom ("LEITE UHT ITALAC").
  const firstWord = wordScore(listWords[0], receiptWords[0]) > 0 ? 0.05 : 0;
  return Math.min(1, score + firstWord);
}

const THRESHOLD = 0.6;

/**
 * Para cada linha do cupom, a posição do item da lista que corresponde (ou null).
 * Cada item da lista recebe uma linha; quem pediu mais de uma unidade ("2 iogurtes")
 * pode receber várias linhas.
 */
export function matchReceipt(listItems: PurchasedItem[], receiptItems: { description: string }[]): (number | null)[] {
  const pairs: { line: number; index: number; score: number }[] = [];
  receiptItems.forEach((receiptItem, line) => {
    listItems.forEach((listItem, index) => {
      const score = matchScore(listItem.text, receiptItem.description);
      if (score >= THRESHOLD) pairs.push({ line, index, score });
    });
  });
  pairs.sort((a, b) => b.score - a.score || a.line - b.line);

  const result: (number | null)[] = receiptItems.map(() => null);
  const used = new Map<number, number>();
  for (const allowExtra of [false, true]) {
    for (const { line, index } of pairs) {
      if (result[line] !== null) continue;
      const count = used.get(index) ?? 0;
      if (count > 0 && (!allowExtra || count >= listItems[index].quantity)) continue;
      result[line] = index;
      used.set(index, count + 1);
    }
  }
  return result;
}

/** Junta a leitura da foto e o QR code num cupom pronto para revisar. */
export function buildReceipt(
  listItems: PurchasedItem[],
  reading: ReceiptReading | null,
  qr: NfceQr | null,
  now = new Date(),
): Receipt {
  const items = reading?.items ?? [];
  const links = matchReceipt(listItems, items);
  return {
    accessKey: qr?.accessKey ?? null,
    storeName: reading?.storeName ?? "",
    cnpj: qr?.cnpj ?? reading?.cnpj ?? null,
    issuedOn: reading?.issuedOn ?? qr?.issuedOn ?? null,
    totalCents: reading?.totalCents ?? qr?.totalCents ?? null,
    source: reading ? "foto" : "qrcode",
    readAt: now.toISOString(),
    items: items.map((item, index) => ({ ...item, listIndex: links[index] })),
  };
}

/* ---------- Cupom em várias fotos ---------- */

/** Quantas fotos um cupom pode ter. Cada foto gasta uma leitura do limite diário. */
export const MAX_RECEIPT_PHOTOS = 6;

/** O cupom já salvo, de volta ao formato da leitura, para receber mais uma parte. */
export function readingFromReceipt(receipt: Receipt): ReceiptReading {
  return {
    storeName: receipt.storeName,
    cnpj: receipt.cnpj,
    issuedOn: receipt.issuedOn,
    totalCents: receipt.totalCents,
    items: receipt.items.map(({ listIndex: _listIndex, ...item }) => item),
  };
}

function sameLine(a: ReceiptReading["items"][number], b: ReceiptReading["items"][number]): boolean {
  const text = (value: string) => value.toLowerCase().replace(/\s+/g, " ").trim();
  return text(a.description) === text(b.description) && a.totalCents === b.totalCents && a.quantity === b.quantity;
}

/** Quantas linhas do fim de uma parte se repetem no começo da próxima (fotos sobrepostas). */
function overlap(previous: ReceiptReading["items"], next: ReceiptReading["items"]): number {
  const limit = Math.min(previous.length, next.length, 8);
  for (let size = limit; size > 0; size--) {
    const tail = previous.slice(previous.length - size);
    if (tail.every((line, index) => sameLine(line, next[index]))) return size;
  }
  return 0;
}

/**
 * Junta as fotos de um cupom grande, na ordem em que foram tiradas. Loja, CNPJ e data vêm
 * da primeira foto que os tiver; o total, da última (ele fica no fim do cupom). Linhas que
 * aparecem no fim de uma foto e no começo da seguinte entram uma vez só.
 */
export function mergeReadings(readings: ReceiptReading[]): ReceiptReading {
  const items: ReceiptReading["items"] = [];
  for (const reading of readings) items.push(...reading.items.slice(overlap(items, reading.items)));
  const first = <T>(pick: (reading: ReceiptReading) => T | null | ""): T | null => {
    for (const reading of readings) {
      const value = pick(reading);
      if (value !== null && value !== "") return value as T;
    }
    return null;
  };
  const last = [...readings].reverse().find((reading) => reading.totalCents !== null);
  return {
    storeName: first((reading) => reading.storeName) ?? "",
    cnpj: first((reading) => reading.cnpj),
    issuedOn: first((reading) => reading.issuedOn),
    totalCents: last?.totalCents ?? null,
    items,
  };
}

export interface ReceiptRelations {
  /** Itens da lista que vieram no cupom, com as linhas e o valor somado. */
  matched: { index: number; item: PurchasedItem; lines: ReceiptItem[]; totalCents: number }[];
  /** Linhas do cupom que não estavam na lista. */
  extras: ReceiptItem[];
  /** Itens da lista que não aparecem no cupom. */
  missing: { index: number; item: PurchasedItem }[];
  itemsTotalCents: number;
}

export function relate(listItems: PurchasedItem[], receipt: Receipt): ReceiptRelations {
  const byIndex = new Map<number, ReceiptItem[]>();
  const extras: ReceiptItem[] = [];
  for (const line of receipt.items) {
    if (line.listIndex === null || line.listIndex >= listItems.length) extras.push(line);
    else byIndex.set(line.listIndex, [...(byIndex.get(line.listIndex) ?? []), line]);
  }
  const matched: ReceiptRelations["matched"] = [];
  const missing: ReceiptRelations["missing"] = [];
  listItems.forEach((item, index) => {
    const lines = byIndex.get(index);
    if (lines) matched.push({ index, item, lines, totalCents: lines.reduce((sum, line) => sum + line.totalCents, 0) });
    else missing.push({ index, item });
  });
  return {
    matched,
    extras,
    missing,
    itemsTotalCents: receipt.items.reduce((sum, line) => sum + line.totalCents, 0),
  };
}

/** "2 UN" ou "0,835 KG". */
export function formatQuantity(item: Pick<ReceiptItem, "quantity" | "unit">): string {
  const quantity = item.quantity.toLocaleString("pt-BR", { maximumFractionDigits: 3 });
  return item.unit ? `${quantity} ${item.unit}` : quantity;
}
