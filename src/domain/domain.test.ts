import { describe, expect, it } from "vitest";
import { CATEGORY_ORDER, groupByCategory, knownCategories } from "./categories";
import { createItem, parseImport, parseQuantity } from "./items";
import { centsToInput, describePayment, formatMoney, monthTotal, parseMoney } from "./money";
import type { Purchase } from "./types";

describe("parseImport", () => {
  it("usa linhas de categoria como título", () => {
    const items = parseImport("Hortifruti\nBanana\n\nLimpeza:\nDetergente", CATEGORY_ORDER, "Outros");
    expect(items.map((i) => [i.text, i.category])).toEqual([
      ["Banana", "Hortifruti"],
      ["Detergente", "Limpeza"],
    ]);
  });

  it("usa a categoria padrão antes do primeiro título", () => {
    const [item] = parseImport("Banana", CATEGORY_ORDER, "Mercearia");
    expect(item.category).toBe("Mercearia");
  });

  it("remove marcadores de lista, inclusive em títulos", () => {
    const items = parseImport("- Bebidas\n1. Suco\n[x] Água\n• Chá", CATEGORY_ORDER, "Outros");
    expect(items.map((i) => [i.text, i.category])).toEqual([
      ["Suco", "Bebidas"],
      ["Água", "Bebidas"],
      ["Chá", "Bebidas"],
    ]);
  });

  it("preserva a ordem colada", () => {
    const items = parseImport("A\nB\nC", CATEGORY_ORDER, "Outros");
    const sorted = [...items].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    expect(sorted.map((i) => i.text)).toEqual(["A", "B", "C"]);
  });
});

describe("parseQuantity", () => {
  it.each([
    ["2 frangos", "Frangos", 2],
    ["3x leite", "Leite", 3],
    ["10 × ovos", "Ovos", 10],
    ["Tomate", "Tomate", 1],
    ["Refrigerante 1L", "Refrigerante 1L", 1],
    ["2 kg arroz", "2 kg arroz", 1],
    ["500 g queijo", "500 g queijo", 1],
    ["0 coisas", "0 coisas", 1],
    ["7", "7", 1],
    ["peixe 2x", "Peixe", 2],
    ["Peixe 2 x", "Peixe", 2],
    ["peixe x2", "Peixe", 2],
    ["Peixe ×3", "Peixe", 3],
    ["peixe (4)", "Peixe", 4],
    ["peixe 2 un", "Peixe", 2],
    ["Ovos - 12 unidades", "Ovos", 12],
    ["2 un peixe", "Peixe", 2],
    ["1x peixe", "Peixe", 1],
    ["peixe 1x", "Peixe", 1],
    ["filé de peixe 2x", "Filé de peixe", 2],
    ["2 xícaras", "Xícaras", 2],
    ["Coca-Cola 2L", "Coca-Cola 2L", 1],
    ["Arroz 5kg", "Arroz 5kg", 1],
    ["Kit 3x1", "Kit 3x1", 1],
    ["Peixe 0x", "Peixe 0x", 1],
    ["Peixe 1", "Peixe", 1],
    ["café 2", "Café", 2],
    ["Ovos - 12", "Ovos", 12],
    ["Molho 3 queijos 2", "Molho 3 queijos", 2],
    ["Molho 3 queijos", "Molho 3 queijos", 1],
    ["Peixe 0", "Peixe 0", 1],
    ["Arroz 5 kg", "Arroz 5 kg", 1],
  ])("%s", (input, text, quantity) => {
    expect(parseQuantity(input)).toEqual({ text, quantity });
  });
});

describe("parseMoney", () => {
  it.each([
    ["152,90", 15290],
    ["152.90", 15290],
    ["R$ 80", 8000],
    ["80", 8000],
    ["1.234,56", 123456],
    ["1.234", 123400],
    ["0,5", 50],
    [" 12,3 ", 1230],
  ])("%s vira %i centavos", (input, cents) => {
    expect(parseMoney(input)).toBe(cents);
  });

  it.each(["", "abc", "0", "0,00", "-5", "12,345", "1,2,3", "10e3"])("recusa %j", (input) => {
    expect(parseMoney(input)).toBeNull();
  });
});

describe("forma de pagamento", () => {
  const base = { amountCents: 15290 };

  it("descreve cada forma", () => {
    expect(describePayment({ ...base, method: "pix", installments: 1 })).toBe("PIX");
    expect(describePayment({ ...base, method: "debito", installments: 1 })).toBe("Débito");
    expect(describePayment({ ...base, method: "dinheiro", installments: 1 })).toBe("Dinheiro");
    expect(describePayment({ ...base, method: "credito", installments: 1 })).toBe("Crédito à vista");
    expect(describePayment({ ...base, method: "credito", installments: 3 })).toMatch(/^Crédito em 3x de R\$\s50,97$/);
  });

  it("volta para o formato digitado", () => {
    expect(centsToInput(15290)).toBe("152,90");
    expect(centsToInput(8000)).toBe("80,00");
    expect(parseMoney(centsToInput(123456))).toBe(123456);
  });

  it("formata em reais", () => {
    expect(formatMoney(123456)).toMatch(/^R\$\s1\.234,56$/);
  });

  it("soma só as compras do mês", () => {
    const purchase = (createdAt: string, amountCents: number): Purchase => ({
      id: crypto.randomUUID(), amountCents, method: "pix", installments: 1, itemCount: 1, memberName: "Renan", createdAt, items: [],
    });
    const total = monthTotal(
      [purchase("2026-11-03T12:00:00.000Z", 10000), purchase("2026-11-20T12:00:00.000Z", 5050), purchase("2026-10-30T12:00:00.000Z", 9999)],
      new Date("2026-11-25T12:00:00.000Z"),
    );
    expect(total).toEqual({ cents: 15050, count: 2 });
  });
});

describe("categorias", () => {
  it("agrupa na ordem do mercado e deixa as criadas por último", () => {
    const groups = groupByCategory([
      createItem("Sabão", "Limpeza"),
      createItem("Caneta", "Tese"),
      createItem("Maçã", "Hortifruti"),
    ]);
    expect(groups.map((g) => g.category)).toEqual(["Hortifruti", "Limpeza", "Tese"]);
  });

  it("não repete categoria com maiúsculas diferentes", () => {
    const categories = knownCategories(["Tese", "tese", "hortifruti"], []);
    expect(categories.filter((c) => c.toLowerCase() === "tese")).toHaveLength(1);
    expect(categories.filter((c) => c.toLowerCase() === "hortifruti")).toEqual(["Hortifruti"]);
  });
});
