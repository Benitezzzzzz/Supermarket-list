import { describe, expect, it } from "vitest";
import { buildReceipt, matchReceipt, matchScore, parseNfceQr, relate } from "./receipt";
import type { PurchasedItem } from "./types";

// QR do cupom real de teste (RC Comércio de Alimentos, João Pessoa, emitido em contingência).
const QR =
  "https://www5.receita.pb.gov.br/atf/seg/SEGf_AcessarFuncao.jsp?cdFuncao=FIS_1410&?p=25261107309087000122651110005414179346777270|2|1|04|17.38||1|C1D1F824197125F43A8B2FC7EEA6533794DAEC59";

const item = (text: string, quantity = 1): PurchasedItem => ({ text, quantity, category: "Outros", done: true });

describe("QR code da NFC-e", () => {
  it("lê a chave, a loja e, em contingência, o dia e o valor", () => {
    const qr = parseNfceQr(QR);
    expect(qr).toMatchObject({
      accessKey: "25261107309087000122651110005414179346777270",
      state: "25",
      cnpj: "07309087000122",
      yearMonth: "2026-11",
      series: "111",
      number: "541417",
      issuedOn: "2026-11-04",
      totalCents: 1738,
    });
    // O endereço antigo do QR não responde mais; a consulta vai para o atual.
    expect(qr?.sefazUrl).toMatch(/^https:\/\/www4\.sefaz\.pb\.gov\.br\/.+p=25261107309087000122651110005414179346777270/);
  });

  it("QR normal (sem contingência) não traz valor", () => {
    // Mesma chave trocando o tipo de emissão para 1 e recalculando o dígito.
    const qr = parseNfceQr("25261107309087000122651110005414171346777274|2|1|1|ABCDEF");
    expect(qr).toMatchObject({ issuedOn: null, totalCents: null });
  });

  it("aceita só a chave e recusa o que não é NFC-e", () => {
    expect(parseNfceQr("2526 1107 3090 8700 0122 6511 1000 5414 1793 4677 7270")?.number).toBe("541417");
    expect(parseNfceQr("https://example.com")).toBeNull();
    expect(parseNfceQr("25261107309087000122651110005414179346777271")).toBeNull(); // dígito errado
  });
});

describe("ligar a lista ao cupom", () => {
  it("entende abreviações, plural e acento", () => {
    expect(matchScore("Leite", "LEITE UHT ITALAC INT 1L")).toBeGreaterThanOrEqual(0.9);
    expect(matchScore("Papel higiênico", "PAP HIG NEVE 12UN")).toBeGreaterThanOrEqual(0.9);
    expect(matchScore("Maçãs", "MACA GALA KG")).toBeGreaterThanOrEqual(0.9);
    expect(matchScore("Frango", "FRANG CONG SEARA KG")).toBeGreaterThanOrEqual(0.8);
    expect(matchScore("Detergente", "DET YPE NEUTRO 500ML")).toBeGreaterThanOrEqual(0.9);
    expect(matchScore("Arroz", "FEIJAO CARIOCA KICALDO 1KG")).toBe(0);
    // Erros de leitura da foto ainda ligam; palavras parecidas por acaso, não.
    expect(matchScore("Amendoim", "ANEDOIIH PETTIZ CRC 120G")).toBeGreaterThanOrEqual(0.6);
    expect(matchScore("Leite", "LENTE DE CONTATO")).toBeLessThan(0.6);
    expect(matchScore("Arroz", "AROMA LIMPEZA")).toBe(0);
  });

  it("cada linha vai para o item certo e o que sobra fica fora da lista", () => {
    const list = [item("Arroz"), item("Leite"), item("Feijão"), item("Sabonete")];
    const lines = [
      { description: "LEITE UHT ITALAC INT 1L" },
      { description: "ARROZ T1 TIO JOAO 5KG" },
      { description: "AMENDOIM PETTIZ CROC 120G" },
      { description: "FEIJAO CARIOCA KICALDO 1KG" },
    ];
    expect(matchReceipt(list, lines)).toEqual([1, 0, null, 2]);
  });

  it("quem pediu 2 pode receber duas linhas; quem pediu 1 recebe só uma", () => {
    const lines = [{ description: "IOGURTE NESTLE MORANGO" }, { description: "IOGURTE NESTLE COCO" }];
    expect(matchReceipt([item("Iogurte", 2)], lines)).toEqual([0, 0]);
    expect(matchReceipt([item("Iogurte")], lines)).toEqual([0, null]);
  });

  it("monta o cupom e separa da lista, fora da lista e faltou", () => {
    const list = [item("Amendoim"), item("Café")];
    const receipt = buildReceipt(
      list,
      {
        storeName: "RC Comercio de Alimentos LTDA",
        cnpj: "07309087000122",
        issuedOn: "2026-11-04",
        totalCents: 1738,
        items: [
          { code: "7896058599848", description: "AMENDOIM PETTIZ CROC 120G PIMENTA VERDE", quantity: 2, unit: "UN", unitCents: 869, totalCents: 1738 },
        ],
      },
      parseNfceQr(QR),
      new Date("2026-11-07T20:00:00Z"),
    );
    expect(receipt).toMatchObject({ accessKey: "25261107309087000122651110005414179346777270", source: "foto", totalCents: 1738 });
    const relations = relate(list, receipt);
    expect(relations.matched.map((m) => [m.item.text, m.totalCents])).toEqual([["Amendoim", 1738]]);
    expect(relations.missing.map((m) => m.item.text)).toEqual(["Café"]);
    expect(relations.extras).toEqual([]);
  });

  it("só o QR: cupom sem itens, com a chave e o valor da contingência", () => {
    const receipt = buildReceipt([item("Café")], null, parseNfceQr(QR));
    expect(receipt).toMatchObject({ source: "qrcode", items: [], totalCents: 1738, cnpj: "07309087000122", issuedOn: "2026-11-04" });
  });
});
