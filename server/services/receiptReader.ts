import { MAX_AMOUNT_CENTS, MAX_RECEIPT_ITEMS, type ReceiptReading } from "../../shared/contract.ts";

/** O que está na foto: um cupom fiscal ou uma lista de compras escrita (à mão ou não). */
export type PhotoKind = "receipt" | "list";

/** Lê a foto e devolve o JSON que o modelo escreveu (ainda sem validar). */
export interface ReceiptReader {
  read(imageBase64: string, kind?: PhotoKind): Promise<unknown>;
}

/** A IA não conseguiu responder (cota do dia esgotada, fora do ar...). */
export class ReaderUnavailableError extends Error {
  quotaExceeded: boolean;

  constructor(message: string, quotaExceeded = false) {
    super(message);
    this.quotaExceeded = quotaExceeded;
  }
}

/** Modelo com visão do Workers AI; no plano grátis cabem dezenas de cupons por dia. */
export const RECEIPT_MODEL = "@cf/meta/llama-4-scout-17b-16e-instruct";

const PROMPT = `Você lê fotos de cupons fiscais brasileiros (NFC-e) e transcreve os produtos comprados.
Responda somente com JSON, sem nenhum texto fora dele, neste formato:
{"loja":"","cnpj":"","data":"DD/MM/AAAA","itens":[{"codigo":"","descricao":"","quantidade":0,"unidade":"","valorUnitario":0,"valorTotal":0}],"total":0}
Regras:
- Um objeto por linha de produto, na ordem do cupom. Copie a descrição como está impressa.
- "codigo" é o número antes da descrição (código de barras ou código interno).
- Quantidade pode ter casas decimais (produtos pesados em KG).
- Valores com ponto decimal. "valorTotal" é o valor da linha; se houver desconto no item, use o valor já com desconto.
- "total" é o "Valor a pagar".
- Não invente nada. Campo ilegível fica vazio ("") ou 0.`;

const LIST_PROMPT = `Você lê fotos de listas de compras de supermercado em português do Brasil, quase sempre escritas à mão, e transcreve os itens.
Responda somente com JSON, sem nenhum texto fora dele, neste formato:
{"linhas":["2 leite","Arroz 5kg","Limpeza","Detergente"]}
Regras:
- Uma linha por item, na ordem da lista. Mantenha a quantidade se estiver escrita ("2 leite", "ovos 12", "3x sabão").
- Medidas fazem parte do nome ("Arroz 5kg", "Coca-Cola 2L").
- Se a lista tiver títulos de seção (ex.: "Limpeza", "Hortifruti"), coloque o título numa linha própria, antes dos itens dele.
- Leia a letra à mão com cuidado e escreva o nome do produto com a grafia correta ("fejão" vira "Feijão").
- Ignore itens riscados, datas, preços, assinaturas e rabiscos.
- Não invente itens. Palavra ilegível fica de fora.
- Se não houver lista de compras na foto, responda {"linhas":[]}.`;

interface AiBinding {
  run(model: string, input: unknown): Promise<unknown>;
}

export function workersAiReader(ai: AiBinding): ReceiptReader {
  return {
    async read(imageBase64, kind = "receipt") {
      let result: unknown;
      try {
        result = await ai.run(RECEIPT_MODEL, {
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: kind === "list" ? LIST_PROMPT : PROMPT },
                { type: "image_url", image_url: { url: `data:image/jpeg;base64,${imageBase64}` } },
              ],
            },
          ],
          max_tokens: 4096,
          temperature: 0,
        });
      } catch (error) {
        const message = String(error);
        // 4006: a cota grátis diária de "neurons" acabou.
        const quota = /4006|daily free allocation|neurons/i.test(message);
        throw new ReaderUnavailableError(message, quota);
      }
      return extractJson(result);
    },
  };
}

/** O Workers AI devolve { response } (objeto ou texto) ou o formato de chat da OpenAI. */
export function extractJson(result: unknown): unknown {
  const record = (result ?? {}) as Record<string, unknown>;
  let content: unknown = record.response;
  if (content === undefined) {
    const choices = record.choices as { message?: { content?: unknown } }[] | undefined;
    content = choices?.[0]?.message?.content;
  }
  if (typeof content !== "string") return content ?? null;
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  const text = fenced ? fenced[1] : content;
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

/** "8,69", "R$ 8.69", 8.69 → 869 centavos. */
function toCents(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) && value >= 0 ? Math.min(Math.round(value * 100), MAX_AMOUNT_CENTS) : null;
  }
  if (typeof value !== "string") return null;
  let text = value.replace(/R\$|\s/g, "");
  if (/,\d{1,2}$/.test(text)) text = text.replace(/\./g, "").replace(",", ".");
  const number = Number(text);
  return text && Number.isFinite(number) && number >= 0 ? Math.min(Math.round(number * 100), MAX_AMOUNT_CENTS) : null;
}

function toQuantity(value: unknown): number {
  const number = typeof value === "string" ? Number(value.replace(",", ".")) : Number(value);
  if (!Number.isFinite(number) || number <= 0) return 1;
  return Math.min(Math.round(number * 1000) / 1000, 100_000);
}

function text(value: unknown, max: number): string {
  return typeof value === "string" || typeof value === "number" ? String(value).replace(/\s+/g, " ").trim().slice(0, max) : "";
}

/** "04/11/2026" ou "04/11/26" → "2026-11-04". */
function toIsoDate(value: unknown): string | null {
  const match = text(value, 20).match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4}|\d{2})(?!\d)/);
  if (!match) return null;
  const [, day, month, rawYear] = match;
  const year = rawYear.length === 2 ? `20${rawYear}` : rawYear;
  const iso = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  const date = new Date(`${iso}T12:00:00Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== iso ? null : iso;
}

/**
 * Transforma o JSON do modelo no formato do app. Linhas sem descrição ou sem valor
 * são descartadas; linhas iguais (mesmo código e preço) viram uma só com a quantidade somada.
 */
export function normalizeReading(raw: unknown): ReceiptReading {
  const data = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const rawItems = Array.isArray(data.itens) ? data.itens : Array.isArray(data.items) ? data.items : [];
  const items: ReceiptReading["items"] = [];

  for (const entry of rawItems.slice(0, MAX_RECEIPT_ITEMS * 2)) {
    if (!entry || typeof entry !== "object") continue;
    const line = entry as Record<string, unknown>;
    const description = text(line.descricao ?? line.description, 120);
    if (!description) continue;
    const quantity = toQuantity(line.quantidade ?? line.quantity);
    let unitCents = toCents(line.valorUnitario ?? line.unitPrice);
    let totalCents = toCents(line.valorTotal ?? line.total);
    if (totalCents === null && unitCents !== null) totalCents = Math.round(unitCents * quantity);
    if (unitCents === null && totalCents !== null) unitCents = Math.round(totalCents / quantity);
    if (totalCents === null || unitCents === null || totalCents === 0) continue;

    const code = text(line.codigo ?? line.code, 20).replace(/\D/g, "");
    const unit = text(line.unidade ?? line.unit, 6).toUpperCase();
    const same = items.find(
      (item) => code && item.code === code && item.unitCents === unitCents && item.description === description,
    );
    if (same) {
      same.quantity = Math.round((same.quantity + quantity) * 1000) / 1000;
      same.totalCents = Math.min(same.totalCents + totalCents, MAX_AMOUNT_CENTS);
      continue;
    }
    items.push({ code, description, quantity, unit, unitCents, totalCents });
  }

  const cnpj = text(data.cnpj, 30).replace(/\D/g, "");
  return {
    storeName: text(data.loja ?? data.store, 120),
    cnpj: cnpj.length === 14 ? cnpj : null,
    issuedOn: toIsoDate(data.data ?? data.date),
    totalCents: toCents(data.total) || null,
    items: items.slice(0, MAX_RECEIPT_ITEMS),
  };
}

/** Quantas linhas a leitura de uma lista escrita devolve, no máximo. */
export const MAX_LIST_LINES = 150;

/**
 * A lista escrita vira texto, uma linha por item, no formato do "Colar vários itens":
 * a pessoa confere e corrige antes de importar.
 */
export function normalizeListReading(raw: unknown): string {
  const data = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const rawLines = [data.linhas, data.itens, data.items, data.lines].find(Array.isArray) ?? [];
  const lines: string[] = [];
  for (const entry of rawLines) {
    if (lines.length >= MAX_LIST_LINES) break;
    let line = "";
    if (typeof entry === "string") line = entry;
    else if (entry && typeof entry === "object") {
      // O modelo às vezes devolve {"nome": "Leite", "quantidade": 2}.
      const record = entry as Record<string, unknown>;
      const name = text(record.nome ?? record.name ?? record.item, 80);
      const quantity = Number(record.quantidade ?? record.quantity);
      line = name && Number.isInteger(quantity) && quantity > 1 && quantity <= 999 ? `${quantity} ${name}` : name;
    }
    const clean = text(line, 80);
    if (/\p{L}/u.test(clean)) lines.push(clean);
  }
  return lines.join("\n");
}
