import { describe, expect, it } from "vitest";
import { CATEGORY_ORDER } from "./categories";
import { parseImport } from "./items";

const categories = [...CATEGORY_ORDER, "Pousada"];
const parse = (text: string, fallback = "Outros") =>
  parseImport(text, categories, fallback).map((item) => [item.quantity, item.text, item.category]);

describe("colar lista do WhatsApp", () => {
  it("mensagem copiada com data, hora e nome", () => {
    const text = [
      "[07/11/26, 14:32:10] Elson: Arroz",
      "[07/11/26, 14:32:15] Elson: 2 leite",
      "[14:33, 07/11/2026] Maria: Café",
      "07/11/2026 14:34 - Elson: Feijão",
    ].join("\n");
    expect(parse(text)).toEqual([
      [1, "Arroz", "Outros"],
      [2, "Leite", "Outros"],
      [1, "Café", "Outros"],
      [1, "Feijão", "Outros"],
    ]);
  });

  it("negrito, emojis e marcadores", () => {
    const text = ["🛒 *Lista de compras*", "", "*Hortifruti* 🥬", "- 🍅 Tomate", "• Cebola", "▪️ Alho", "1. Batata", "☑️ Cenoura", "✅ Limão"].join("\n");
    expect(parse(text)).toEqual([
      [1, "Tomate", "Hortifruti"],
      [1, "Cebola", "Hortifruti"],
      [1, "Alho", "Hortifruti"],
      [1, "Batata", "Hortifruti"],
      [1, "Cenoura", "Hortifruti"],
      [1, "Limão", "Hortifruti"],
    ]);
  });

  it("títulos comuns viram a categoria certa", () => {
    const text = ["Frutas e verduras:", "banana", "Carnes:", "frango", "*FRIOS*", "queijo", "Higiene", "sabonete", "Produtos de limpeza:", "detergente"].join("\n");
    expect(parse(text).map(([, text, category]) => [text, category])).toEqual([
      ["Banana", "Hortifruti"],
      ["Frango", "Açougue e Peixaria"],
      ["Queijo", "Laticínios e Frios"],
      ["Sabonete", "Higiene e Farmácia"],
      ["Detergente", "Limpeza"],
    ]);
  });

  it("vários itens na mesma linha, sem quebrar 1,5 kg", () => {
    expect(parse("arroz, feijão, café; açúcar\n1,5 kg de carne").map(([, text]) => text)).toEqual([
      "Arroz",
      "Feijão",
      "Café",
      "Açúcar",
      "1,5 kg de carne",
    ]);
  });

  it("quantidade no fim ou na frente", () => {
    expect(parse("Arroz x2\nLeite (3)\nOvos - 2 un\n3x sabão\n2 kg batata")).toEqual([
      [2, "Arroz", "Outros"],
      [3, "Leite", "Outros"],
      [2, "Ovos", "Outros"],
      [3, "Sabão", "Outros"],
      [1, "2 kg batata", "Outros"],
    ]);
  });

  it("ignora mídia, mensagem apagada e títulos genéricos", () => {
    const text = [
      "[07/11/26, 14:30:00] Elson: Lista do mercado:",
      "[07/11/26, 14:30:05] Elson: <Mídia oculta>",
      "[07/11/26, 14:30:06] Elson: Esta mensagem foi apagada",
      "Para a pousada:",
      "Toalhas (editada)",
    ].join("\n");
    expect(parse(text).map(([, text]) => text)).toEqual(["Toalhas"]);
  });

  it("repetidos entram uma vez", () => {
    expect(parse("Arroz\narroz\n- ARROZ").map(([, text]) => text)).toEqual(["Arroz"]);
  });

  it("categoria criada pela família também vira título", () => {
    expect(parse("Pousada:\nlençol").map(([, text, category]) => [text, category])).toEqual([["Lençol", "Pousada"]]);
  });

  it("emoji no fim da linha não entra no nome", () => {
    expect(parse("Pão 🥖\nLeite 🥛🥛").map(([, text]) => text)).toEqual(["Pão", "Leite"]);
  });

  it("mensagem real de exemplo", () => {
    const text = `[07/11/26, 18:02:11] Elson: *Compras pousada* 🏡
[07/11/26, 18:02:11] Elson: Café 2
[07/11/26, 18:02:11] Elson: Açúcar x2
[07/11/26, 18:02:12] Elson: papel higiênico, sabonete, detergente
[07/11/26, 18:02:13] Elson: _Frutas_
[07/11/26, 18:02:13] Elson: 1 melão
[07/11/26, 18:02:13] Elson: Banana`;
    expect(parse(text)).toEqual([
      [2, "Café", "Outros"],
      [2, "Açúcar", "Outros"],
      [1, "Papel higiênico", "Outros"],
      [1, "Sabonete", "Outros"],
      [1, "Detergente", "Outros"],
      [1, "Melão", "Hortifruti"],
      [1, "Banana", "Hortifruti"],
    ]);
  });
});
