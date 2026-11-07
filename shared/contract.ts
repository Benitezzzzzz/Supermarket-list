import { z } from "zod";

/** Contrato entre frontend e backend. O servidor valida tudo que chega com estes esquemas. */

export const MAX_ITEM_TEXT = 80;
export const MAX_CATEGORY = 40;
export const MAX_NAME = 40;
export const MAX_QUANTITY = 999;
export const MAX_BATCH = 500;

const categoryName = z.string().trim().min(1).max(MAX_CATEGORY);

export const itemSchema = z.object({
  id: z.uuid(),
  text: z.string().trim().min(1).max(MAX_ITEM_TEXT),
  quantity: z.number().int().min(1).max(MAX_QUANTITY),
  done: z.boolean(),
  category: categoryName,
  createdAt: z.iso.datetime({ offset: true }),
});

export const upsertItemsSchema = z.object({
  items: z.array(itemSchema).min(1).max(MAX_BATCH),
});

export const deleteItemsSchema = z.object({
  ids: z.array(z.uuid()).min(1).max(MAX_BATCH),
});

export const addCategorySchema = z.object({ name: categoryName });

/** Sem convite, a pessoa entra na única família do app, se a entrada estiver aberta. */
export const joinSchema = z.object({
  inviteToken: z.string().regex(/^[0-9a-f]{64}$/).optional(),
  name: z.string().trim().min(1).max(MAX_NAME),
});

export const entrySchema = z.object({ open: z.boolean() });

export interface FamilySettings {
  openJoin: boolean;
}

export const MAX_INSTALLMENTS = 24;
export const MAX_AMOUNT_CENTS = 100_000_000;

const onlyCreditSplits = {
  check: (payment: { method: string; installments: number }) =>
    payment.method === "credito" || payment.installments === 1,
  message: "Só o crédito pode ser parcelado",
};

/** Valor e forma de pagamento: o que dá para corrigir depois. */
const paymentFields = {
  amountCents: z.number().int().min(1).max(MAX_AMOUNT_CENTS),
  method: z.enum(["pix", "dinheiro", "debito", "credito"]),
  installments: z.number().int().min(1).max(MAX_INSTALLMENTS),
};

/** Compra finalizada. O valor fica em centavos para não haver erro de arredondamento. */
export const purchaseSchema = z
  .object({
    id: z.uuid(),
    ...paymentFields,
    itemCount: z.number().int().min(0).max(MAX_BATCH),
    memberName: z.string().max(MAX_NAME),
    createdAt: z.iso.datetime({ offset: true }),
  })
  .refine(onlyCreditSplits.check, { message: onlyCreditSplits.message });

export const paymentSchema = z
  .object(paymentFields)
  .refine(onlyCreditSplits.check, { message: onlyCreditSplits.message });

/** Finalizar registra a compra e tira da lista exatamente os itens que existiam naquela hora. */
export const finishSchema = z.object({
  purchase: purchaseSchema,
  itemIds: z.array(z.uuid()).max(MAX_BATCH),
});

export type Item = z.infer<typeof itemSchema>;
export type Purchase = z.infer<typeof purchaseSchema>;
export type PaymentMethod = Purchase["method"];
export type Payment = z.infer<typeof paymentSchema>;

export interface Snapshot {
  items: Item[];
  customCategories: string[];
  /** Compras mais recentes primeiro. */
  purchases: Purchase[];
}

/** Alteração unitária e idempotente: pode ser reenviada sem efeito colateral. */
export type Op =
  | { kind: "upsert"; items: Item[] }
  | { kind: "delete"; ids: string[] }
  | { kind: "addCategory"; name: string }
  | { kind: "finish"; purchase: Purchase; itemIds: string[] }
  | { kind: "updatePurchase"; id: string; payment: Payment };

export type Role = "admin" | "member";

export interface SessionInfo {
  memberId: string;
  name: string;
  role: Role;
  familyId: string;
  familyName: string;
}

export interface Member {
  id: string;
  name: string;
  role: Role;
  joinedAt: string;
  lastSeenAt: string;
}
