import { describe, expect, it } from "vitest";
import { CATEGORY_ORDER } from "./categories";
import { categoryGuesser, dictionaryCategory } from "./categoryGuess";
import { parseImport } from "./items";

describe("categoria pelo nome do produto", () => {
  it.each([
    ["Banana", "Hortifruti"],
    ["2 bananas", "Hortifruti"],
    ["limões", "Hortifruti"],
    ["Cebola roxa", "Hortifruti"],
    ["Pão francês", "Padaria"],
    ["pães", "Padaria"],
    ["Carne moída", "Açougue e Peixaria"],
    ["Peito de frango", "Açougue e Peixaria"],
    ["Leite", "Laticínios e Frios"],
    ["Queijo mussarela", "Laticínios e Frios"],
    ["Leite condensado", "Mercearia"],
    ["Arroz 5kg", "Mercearia"],
    ["feijão", "Mercearia"],
    ["Molho de tomate", "Mercearia"],
    ["Café", "Mercearia"],
    ["Coca-Cola 2L", "Bebidas"],
    ["Suco de laranja", "Bebidas"],
    ["Água mineral", "Bebidas"],
    ["Detergente", "Limpeza"],
    ["Sabão em pó", "Limpeza"],
    ["Água sanitária", "Limpeza"],
    ["Papel higiênico", "Higiene e Farmácia"],
    ["Creme dental", "Higiene e Farmácia"],
    ["Shampoo", "Higiene e Farmácia"],
    ["Sorvete", "Congelados"],
    ["Pão de queijo", "Congelados"],
  ])("%s → %s", (name, category) => {
    expect(dictionaryCategory(name)).toBe(category);
  });

  it("não chuta quando não conhece", () => {
    expect(dictionaryCategory("Vela de aniversário")).toBeNull();
    expect(dictionaryCategory("123")).toBeNull();
  });

  it("toda categoria do dicionário existe na lista padrão", () => {
    for (const name of ["banana", "pao", "carne", "leite", "arroz", "agua", "detergente", "sabonete", "sorvete"]) {
      expect(CATEGORY_ORDER).toContain(dictionaryCategory(name));
    }
  });

  it("o que a lista já usou vence o dicionário; Outros não ensina", () => {
    const guess = categoryGuesser(
      [
        { text: "Ovos", category: "Laticínios e Frios" },
        { text: "Vela", category: "Outros" },
        { text: "Ração do Totó", category: "Pet" },
        { text: "Ovos", category: "Mercearia" },
      ],
      [...CATEGORY_ORDER, "Pet"],
    );
    expect(guess("2 ovos")).toBe("Mercearia");
    expect(guess("ração do totó")).toBe("Pet");
    expect(guess("Vela")).toBeNull();
    expect(guess("Banana")).toBe("Hortifruti");
  });

  it("categoria que a lista não tem (apagada) não é usada", () => {
    const guess = categoryGuesser([{ text: "Ração", category: "Pet" }], CATEGORY_ORDER);
    expect(guess("Ração")).toBeNull();
  });
});

describe("colar do WhatsApp já separa por categoria", () => {
  const guess = categoryGuesser([], CATEGORY_ORDER);
  const parse = (text: string) =>
    parseImport(text, CATEGORY_ORDER, "Outros", guess).map((item) => [item.quantity, item.text, item.category]);

  it("sem títulos, cada produto vai para a sua categoria", () => {
    const text = `[12/11/26, 09:15:02] Mãe: Lista do mercado
[12/11/26, 09:15:10] Mãe: 2 banana
[12/11/26, 09:15:11] Mãe: detergente, sabão em pó
[12/11/26, 09:15:12] Mãe: Leite x6
[12/11/26, 09:15:13] Mãe: Pão francês
[12/11/26, 09:15:14] Mãe: vela de aniversário`;
    expect(parse(text)).toEqual([
      [2, "Banana", "Hortifruti"],
      [1, "Detergente", "Limpeza"],
      [1, "Sabão em pó", "Limpeza"],
      [6, "Leite", "Laticínios e Frios"],
      [1, "Pão francês", "Padaria"],
      [1, "Vela de aniversário", "Outros"],
    ]);
  });

  it("título escrito na mensagem continua valendo", () => {
    expect(parse("Banana\nLimpeza\nLeite\nPano de chão")).toEqual([
      [1, "Banana", "Hortifruti"],
      [1, "Leite", "Limpeza"],
      [1, "Pano de chão", "Limpeza"],
    ]);
  });
});
