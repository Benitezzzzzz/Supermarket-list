import { describe, expect, it } from "vitest";
import { CATEGORY_ORDER } from "./categories";
import { createItem, parseImport } from "./items";
import { shareText } from "./shareList";

describe("compartilhar a lista", () => {
  const items = [
    createItem("2 tomate", "Hortifruti"),
    createItem("Detergente", "Limpeza"),
    createItem("peixe 3x", "Açougue e Peixaria"),
    { ...createItem("Arroz", "Mercearia"), done: true },
  ];

  it("separa por categoria, com a quantidade, só o que falta", () => {
    const text = shareText("Casa", items);
    expect(text.startsWith("🛒 *Lista Casa*")).toBe(true);
    expect(text).toContain("• 2× Tomate");
    expect(text).toContain("• 1× Detergente");
    expect(text).toContain("• 3× Peixe");
    expect(text).not.toContain("Arroz");
  });

  it("colado de volta no app, entra igual", () => {
    const back = parseImport(shareText("Casa", items), [...CATEGORY_ORDER], "Outros");
    const pending = items.filter((item) => !item.done);
    expect(back.map(({ text, quantity, category }) => [text, quantity, category]).sort()).toEqual(
      pending.map(({ text, quantity, category }) => [text, quantity, category]).sort(),
    );
  });
});
