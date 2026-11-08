import { describe, expect, it } from "vitest";
import { applyPrices, putTemplate } from "../../shared/prices.ts";
import {
  averageBefore,
  compareCents,
  lastMonths,
  localMonths,
  mergeMonths,
  previousMonthKey,
  previousPurchase,
} from "./history";
import { findProduct, normalizeCode } from "./barcodes";
import {
  brandSummary,
  buildPriceIndex,
  estimateList,
  itemPrice,
  lastPrice,
  parsePrice,
  pricedTotal,
  priceTrend,
  productKey,
} from "./prices";
import { createTemplate, itemsFromTemplate } from "./templates";
import type { Item, Purchase, PurchasedItem, Template } from "./types";

/** Compra no horário local do aparelho (dia ao meio-dia, longe da virada do mês). */
function purchase(day: string, amountCents: number, items: PurchasedItem[] = [], overrides: Partial<Purchase> = {}): Purchase {
  const [year, month, date] = day.split("-").map(Number);
  return {
    id: `${day}-${amountCents}`,
    amountCents,
    method: "pix",
    installments: 1,
    itemCount: items.length,
    memberName: "Renan",
    createdAt: new Date(year, month - 1, date, 12).toISOString(),
    items,
    ...overrides,
  };
}

const leite = (overrides: Partial<PurchasedItem> = {}): PurchasedItem => ({
  text: "Leite",
  quantity: 2,
  category: "Laticínios",
  done: true,
  ...overrides,
});

describe("histórico por mês", () => {
  const compras = [purchase("2026-11-05", 3000), purchase("2026-11-01", 1000), purchase("2026-10-20", 5000)];

  it("soma por mês, do mais recente ao mais antigo", () => {
    expect(localMonths(compras)).toEqual([
      { month: "2026-11", totalCents: 4000, count: 2 },
      { month: "2026-10", totalCents: 5000, count: 1 },
    ]);
  });

  it("completa os últimos meses com zero, do mais antigo ao mais novo", () => {
    const months = lastMonths(localMonths(compras), 3, new Date(2026, 10, 8));
    expect(months).toEqual([
      { month: "2026-09", totalCents: 0, count: 0 },
      { month: "2026-10", totalCents: 5000, count: 1 },
      { month: "2026-11", totalCents: 4000, count: 2 },
    ]);
    expect(previousMonthKey("2026-01")).toBe("2025-12");
  });

  it("usa o servidor para o mês mais antigo carregado e os anteriores", () => {
    const server = [
      { month: "2026-11", totalCents: 1, count: 1 },
      { month: "2026-10", totalCents: 9000, count: 3 },
      { month: "2026-09", totalCents: 2000, count: 1 },
    ];
    // Novembro vem do aparelho (pode ter alteração ainda não enviada); outubro está incompleto aqui.
    expect(mergeMonths(compras, server, false)).toEqual([
      { month: "2026-11", totalCents: 4000, count: 2 },
      { month: "2026-10", totalCents: 9000, count: 3 },
      { month: "2026-09", totalCents: 2000, count: 1 },
    ]);
    expect(mergeMonths(compras, server, true)).toEqual(localMonths(compras));
    expect(mergeMonths(compras, null, false)).toEqual(localMonths(compras));
  });

  it("compara com a compra anterior e com a média das anteriores", () => {
    expect(previousPurchase(compras, compras[0].id)?.id).toBe(compras[1].id);
    expect(previousPurchase(compras, compras[2].id)).toBeUndefined();
    expect(averageBefore(compras, compras[0].id)).toEqual({ cents: 3000, count: 2 });
    expect(compareCents(3300, 3000)).toEqual({ diffCents: 300, percent: 10 });
    expect(compareCents(2700, 3000)).toEqual({ diffCents: -300, percent: -10 });
    expect(compareCents(100, 0)).toEqual({ diffCents: 100, percent: null });
  });
});

describe("preços dos itens", () => {
  it("reconhece o mesmo produto escrito de outro jeito", () => {
    expect(productKey("Leites")).toBe(productKey("leite"));
    expect(productKey("Feijão")).toBe(productKey("feijao"));
  });

  it("aceita vazio, zero e valores; recusa texto inválido", () => {
    expect(parsePrice("")).toBeNull();
    expect(parsePrice("0")).toBe(0);
    expect(parsePrice("6,49")).toBe(649);
    expect(parsePrice("abc")).toBeUndefined();
  });

  it("o preço digitado vale mais que o do cupom; sem nenhum, não há preço", () => {
    const base = purchase("2026-11-05", 2000, [leite(), leite({ text: "Café", quantity: 1 })], {
      receipt: {
        accessKey: null,
        storeName: "Mercado",
        cnpj: null,
        issuedOn: null,
        totalCents: 1200,
        source: "foto",
        readAt: new Date().toISOString(),
        items: [
          { code: "", description: "LTE UHT", quantity: 2, unit: "UN", unitCents: 500, totalCents: 1000 },
          { code: "", description: "SACOLA", quantity: 1, unit: "UN", unitCents: 20, totalCents: 20 },
        ].map((line, index) => ({ ...line, listIndex: index === 0 ? 0 : null })),
      },
    });
    expect(itemPrice(base, 0)).toEqual({ unitCents: 500, totalCents: 1000, source: "cupom" });
    expect(itemPrice(base, 1)).toBeNull();
    const typed = { ...base, items: applyPrices(base.items, [{ index: 0, unitCents: 450, brand: "Italac" }]) };
    expect(itemPrice(typed, 0)).toEqual({ unitCents: 450, totalCents: 900, source: "manual" });
    // A sacola fora da lista também foi paga.
    expect(pricedTotal(typed)).toEqual({ cents: 920, priced: 1 });
  });

  it("guarda o histórico por produto e compara marcas", () => {
    const compras = [
      purchase("2026-11-05", 1, [leite({ unitCents: 600, brand: "Italac" })]),
      purchase("2026-10-20", 1, [leite({ unitCents: 450, brand: "Betânia" })]),
      purchase("2026-10-01", 1, [leite({ unitCents: 500, brand: "Italac" }), leite({ text: "Pão", unitCents: null })]),
    ];
    const index = buildPriceIndex(compras);
    expect(index.has(productKey("Pão"))).toBe(false);
    expect(lastPrice(index, "leites")).toMatchObject({ unitCents: 600, brand: "Italac", quantity: 2 });
    expect(lastPrice(index, "Leite", compras[0].id)).toMatchObject({ unitCents: 450, brand: "Betânia" });
    // 600 contra 450 da compra anterior: subiu 33%.
    expect(priceTrend(index, "Leite")?.percent).toBe(33);
    expect(priceTrend(index, "Café")).toBeNull();
    const lista = [
      { id: "1", text: "leites", quantity: 3, done: false, category: "Laticínios", createdAt: "" },
      { id: "2", text: "Café", quantity: 1, done: false, category: "Mercearia", createdAt: "" },
    ];
    expect(estimateList(lista, index)).toEqual({ cents: 1800, priced: 1, missing: 1 });
    expect(brandSummary(index.get(productKey("leite")) ?? [])).toEqual([
      expect.objectContaining({ brand: "Betânia", count: 1, avgUnitCents: 450 }),
      expect.objectContaining({ brand: "Italac", count: 2, avgUnitCents: 550, minUnitCents: 500, lastUnitCents: 600 }),
    ]);
  });
});

describe("modelos de lista", () => {
  const item = (text: string): Item => ({
    id: crypto.randomUUID(),
    text,
    quantity: 1,
    done: true,
    category: "Outros",
    createdAt: new Date().toISOString(),
  });

  it("cria o modelo sem repetir produto e sem marcação", () => {
    const template = createTemplate(" Mês ", [item("Leite"), { ...item("leites"), quantity: 3 }, item("Café")]);
    expect(template.name).toBe("Mês");
    expect(template.items).toEqual([
      { text: "Leite", quantity: 3, category: "Outros" },
      { text: "Café", quantity: 1, category: "Outros" },
    ]);
  });

  it("ao usar, não duplica o que já está na lista e os itens entram desmarcados", () => {
    const template = createTemplate("Mês", [item("Leite"), item("Café")]);
    const added = itemsFromTemplate(template, [item("leites")], 1000);
    expect(added.map((entry) => [entry.text, entry.done])).toEqual([["Café", false]]);
  });

  it("só um modelo fica como padrão", () => {
    const a: Template = { ...createTemplate("A", [], true) };
    const b: Template = { ...createTemplate("B", [], true) };
    const result = putTemplate(putTemplate([], a), b);
    expect(result.map((template) => [template.name, template.isDefault])).toEqual([
      ["A", false],
      ["B", true],
    ]);
  });
});

describe("código de barras", () => {
  it("compara só os dígitos, sem zeros à esquerda", () => {
    expect(normalizeCode("0789 6058-599848")).toBe("7896058599848");
    expect(normalizeCode("abc")).toBeNull();
  });

  it("acha o produto no que a lista aprendeu e depois nos cupons", () => {
    const comCupom = purchase("2026-11-05", 2000, [leite()], {
      receipt: {
        accessKey: null,
        storeName: "",
        cnpj: null,
        issuedOn: null,
        totalCents: null,
        source: "foto",
        readAt: new Date().toISOString(),
        items: [
          { code: "07896058599848", description: "LTE UHT", quantity: 2, unit: "UN", unitCents: 500, totalCents: 1000, listIndex: 0 },
          { code: "7891000100103", description: "SACOLA  PLASTICA", quantity: 1, unit: "UN", unitCents: 15, totalCents: 15, listIndex: null },
        ],
      },
    });
    expect(findProduct("7896058599848", [], [comCupom])).toEqual({ text: "Leite", category: "Laticínios", source: "cupom" });
    expect(findProduct("7891000100103", [], [comCupom])).toEqual({ text: "Sacola plastica", category: "Outros", source: "cupom" });
    const aprendido = [{ code: "7896058599848", text: "Leite Italac", category: "Laticínios e Frios" }];
    expect(findProduct("7896058599848", aprendido, [comCupom])?.text).toBe("Leite Italac");
    expect(findProduct("123456789", [], [comCupom])).toBeNull();
  });
});
