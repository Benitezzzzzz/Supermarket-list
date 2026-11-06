import { describe, expect, it } from "vitest";
import { CATEGORY_ORDER, groupByCategory, knownCategories } from "./categories";
import { createItem, parseImport, parseQuantity } from "./items";

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
  ])("%s", (input, text, quantity) => {
    expect(parseQuantity(input)).toEqual({ text, quantity });
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
