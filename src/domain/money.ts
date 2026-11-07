import type { PaymentMethod, Purchase } from "./types";

export const MAX_AMOUNT_CENTS = 100_000_000;
export const MAX_INSTALLMENTS = 24;

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function formatMoney(cents: number): string {
  return currency.format(cents / 100);
}

/**
 * Lê o valor digitado em reais: "152,90", "152.90", "1.234,56", "R$ 80" ou "80".
 * Devolve centavos, ou null se não for um valor válido.
 */
export function parseMoney(input: string): number | null {
  const cleaned = input.replace(/R\$|\s/g, "");
  let normalized: string;

  if (/^\d{1,3}(\.\d{3})*,\d{1,2}$|^\d+,\d{1,2}$/.test(cleaned)) {
    normalized = cleaned.replace(/\./g, "").replace(",", ".");
  } else if (/^\d{1,3}(\.\d{3})+$/.test(cleaned)) {
    normalized = cleaned.replace(/\./g, ""); // "1.234" são mil duzentos e trinta e quatro reais
  } else if (/^\d+(\.\d{1,2})?$/.test(cleaned)) {
    normalized = cleaned;
  } else {
    return null;
  }

  const cents = Math.round(Number(normalized) * 100);
  return cents > 0 && cents <= MAX_AMOUNT_CENTS ? cents : null;
}

/** Centavos no formato que a pessoa digita: 15290 vira "152,90". */
export function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}

export const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  pix: "PIX",
  dinheiro: "Dinheiro (espécie)",
  debito: "Cartão de débito",
  credito: "Cartão de crédito",
};

/** "PIX", "Débito", "Crédito à vista" ou "Crédito em 3x de R$ 50,97". */
export function describePayment(purchase: Pick<Purchase, "method" | "installments" | "amountCents">): string {
  if (purchase.method === "pix") return "PIX";
  if (purchase.method === "dinheiro") return "Dinheiro";
  if (purchase.method === "debito") return "Débito";
  if (purchase.installments <= 1) return "Crédito à vista";
  const each = Math.round(purchase.amountCents / purchase.installments);
  return `Crédito em ${purchase.installments}x de ${formatMoney(each)}`;
}

/** Soma das compras feitas no mesmo mês e ano da data de referência. */
export function monthTotal(purchases: Purchase[], reference = new Date()): { cents: number; count: number } {
  const inMonth = purchases.filter((purchase) => {
    const date = new Date(purchase.createdAt);
    return date.getMonth() === reference.getMonth() && date.getFullYear() === reference.getFullYear();
  });
  return {
    cents: inMonth.reduce((sum, purchase) => sum + purchase.amountCents, 0),
    count: inMonth.length,
  };
}
