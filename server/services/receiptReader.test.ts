// @vitest-environment node
import { describe, expect, it } from "vitest";
import { extractJson, normalizeReading, ReaderUnavailableError, workersAiReader } from "./receiptReader.ts";

describe("resposta da IA", () => {
  it("aceita objeto pronto, texto com ```json e o formato de chat", () => {
    expect(extractJson({ response: { total: 1 } })).toEqual({ total: 1 });
    expect(extractJson({ response: 'Aqui está:\n```json\n{"total": 2}\n```' })).toEqual({ total: 2 });
    expect(extractJson({ choices: [{ message: { content: '{"total": 3}' } }] })).toEqual({ total: 3 });
    expect(extractJson({ response: "não consegui" })).toBeNull();
  });

  it("datas com ano de 2 ou 4 dígitos; data inválida vira null", () => {
    const date = (data: string) => normalizeReading({ data }).issuedOn;
    expect(date("04/11/2026")).toBe("2026-11-04");
    expect(date("4/11/26")).toBe("2026-11-04");
    expect(date("31/02/2026")).toBeNull();
  });

  it("produto pesado, valores com vírgula e linha sem valor", () => {
    const reading = normalizeReading({
      itens: [
        { codigo: "2000123", descricao: "BANANA PRATA KG", quantidade: "0,835", unidade: "kg", valorUnitario: "5,99", valorTotal: "" },
        { descricao: "LINHA RASGADA", quantidade: 1, valorUnitario: "", valorTotal: "" },
        { descricao: "TOTAL 1.234,56", valorTotal: "1.234,56" },
      ],
      total: "R$ 1.239,56",
    });
    expect(reading.items).toEqual([
      { code: "2000123", description: "BANANA PRATA KG", quantity: 0.835, unit: "KG", unitCents: 599, totalCents: 500 },
      { code: "", description: "TOTAL 1.234,56", quantity: 1, unit: "", unitCents: 123456, totalCents: 123456 },
    ]);
    expect(reading.totalCents).toBe(123956);
  });

  it("cota grátis esgotada vira erro próprio", async () => {
    const reader = workersAiReader({
      run: async () => {
        throw new Error("4006: you have used up your daily free allocation of 10,000 neurons");
      },
    });
    const failure = (await reader.read("AAAA").catch((error) => error)) as ReaderUnavailableError;
    expect(failure).toBeInstanceOf(ReaderUnavailableError);
    expect(failure.quotaExceeded).toBe(true);
  });
});
