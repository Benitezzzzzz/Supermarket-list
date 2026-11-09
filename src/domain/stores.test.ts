import { describe, expect, it } from "vitest";
import { buildPriceIndex, priceTrend, pricesFor, storePrices } from "./prices";
import { knownStores, purchaseStore } from "./storeName";
import { priceGaps, shortStoreName, storeTotals } from "./stores";
import type { Purchase } from "./types";

function purchase(id: number, store: string | null, amountCents: number, createdAt: string, prices: [string, number][] = []): Purchase {
  return {
    id: `00000000-0000-4000-8000-00000000000${id}`,
    amountCents,
    method: "pix",
    installments: 1,
    itemCount: prices.length,
    memberName: "Renan",
    createdAt,
    items: prices.map(([text, cents]) => ({ text, quantity: 1, category: "Outros", done: true, unitCents: cents })),
    receipt:
      store === null
        ? null
        : {
            accessKey: null,
            storeName: store,
            cnpj: null,
            issuedOn: null,
            totalCents: amountCents,
            source: "foto",
            readAt: createdAt,
            items: [],
          },
  } as Purchase;
}

describe("mercados", () => {
  it("encurta o nome do cupom", () => {
    expect(shortStoreName("RC COMERCIO DE ALIMENTOS LTDA")).toBe("RC");
    expect(shortStoreName("SUPERMERCADO BOMPREÇO S/A")).toBe("Bompreço");
    expect(shortStoreName("Atacadão")).toBe("Atacadão");
    expect(shortStoreName("")).toBe("");
  });

  it("soma o mês por mercado e separa as compras sem cupom", () => {
    const purchases = [
      purchase(1, "ATACADAO LTDA", 30000, "2026-11-02T15:00:00.000Z"),
      purchase(2, "Atacadao", 10000, "2026-11-05T15:00:00.000Z"),
      purchase(3, "BOMPRECO S/A", 15000, "2026-11-06T15:00:00.000Z"),
      purchase(4, null, 5000, "2026-11-07T15:00:00.000Z"),
      purchase(5, "BOMPRECO S/A", 99900, "2026-10-07T15:00:00.000Z"),
    ];
    const summary = storeTotals(purchases, "2026-11");
    expect(summary.stores.map((store) => [store.name, store.totalCents, store.count])).toEqual([
      ["Atacadao", 40000, 2],
      ["Bompreco", 15000, 1],
    ]);
    expect(summary.unknown).toEqual({ totalCents: 5000, count: 1 });
  });

  it("mostra onde o mesmo produto saiu mais barato", () => {
    const purchases = [
      purchase(1, "ATACADAO LTDA", 3000, "2026-11-08T15:00:00.000Z", [["Arroz", 2250], ["Café", 1800]]),
      purchase(2, "BOMPRECO S/A", 3000, "2026-11-01T15:00:00.000Z", [["Arroz", 2490], ["Café", 1800]]),
      purchase(3, "BOMPRECO S/A", 3000, "2026-10-01T15:00:00.000Z", [["Arroz", 1990]]),
    ];
    const gaps = priceGaps(buildPriceIndex(purchases));
    // Vale o último preço de cada mercado; o Café custou igual nos dois e não aparece.
    expect(gaps).toHaveLength(1);
    expect(gaps[0].text).toBe("Arroz");
    expect(gaps[0].cheapest).toMatchObject({ store: "Atacadao", unitCents: 2250 });
    expect(gaps[0].priciest).toMatchObject({ store: "Bompreco", unitCents: 2490 });
    expect(gaps[0].percent).toBe(11);
  });

  it("Leite Elegê: R$ 6 num mercado, R$ 7 no outro no mês seguinte", () => {
    const outubro = { ...purchase(1, null, 600, "2026-10-05T15:00:00.000Z", [["Leite Elegê", 600]]), store: "Atacadão" };
    const novembro = { ...purchase(2, null, 700, "2026-11-05T15:00:00.000Z", [["Leite Elegê", 700]]), store: "Bompreço" };
    const index = buildPriceIndex([outubro, novembro]);

    const trend = priceTrend(index, "Leite Elegê");
    expect(trend?.last).toMatchObject({ unitCents: 700, storeName: "Bompreço" });
    expect(trend?.percent).toBe(17);
    expect(trend?.cheaper).toMatchObject({ store: "Atacadão", unitCents: 600 });

    expect(storePrices(pricesFor(index, "leite elege")).map((p) => [p.store, p.unitCents])).toEqual([
      ["Atacadão", 600],
      ["Bompreço", 700],
    ]);
  });

  it("sem outro mercado mais barato, não sugere nada", () => {
    const a = { ...purchase(1, null, 700, "2026-10-05T15:00:00.000Z", [["Leite", 700]]), store: "Atacadão" };
    const b = { ...purchase(2, null, 600, "2026-11-05T15:00:00.000Z", [["Leite", 600]]), store: "atacadao" };
    expect(priceTrend(buildPriceIndex([a, b]), "Leite")?.cheaper).toBeNull();
  });

  it("o mercado digitado vale mais que o do cupom e junta grafias", () => {
    expect(purchaseStore({ store: " Atacadão ", receipt: null })).toBe("Atacadão");
    expect(purchaseStore({ store: "", receipt: purchase(1, "BOMPRECO S/A", 1, "2026-11-01T00:00:00.000Z").receipt })).toBe("Bompreco");
    const purchases = [
      { ...purchase(1, null, 1000, "2026-11-02T15:00:00.000Z"), store: "Atacadão" },
      { ...purchase(2, null, 2000, "2026-11-03T15:00:00.000Z"), store: "atacadao" },
    ];
    expect(storeTotals(purchases, "2026-11").stores).toHaveLength(1);
    expect(knownStores(purchases)).toEqual(["atacadao"]);
  });
});
