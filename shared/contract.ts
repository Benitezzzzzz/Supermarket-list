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

export const MAX_LIST_NAME = 40;

/** Usuário: letras minúsculas, números, ponto, hífen ou sublinhado. */
export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9._-]{3,30}$/);

/** Chave derivada da senha no aparelho (PBKDF2). A senha em si nunca é enviada. */
export const passwordKeySchema = z.string().regex(/^[0-9a-f]{64}$/);

export const signupSchema = z.object({
  username: usernameSchema,
  displayName: z.string().trim().min(1).max(MAX_NAME),
  passwordKey: passwordKeySchema,
});

export const loginSchema = z.object({
  username: usernameSchema,
  passwordKey: passwordKeySchema,
});

export const changePasswordSchema = z.object({
  currentKey: passwordKeySchema,
  newKey: passwordKeySchema,
});

/** O administrador geral define a senha de alguém: chega só a chave derivada. */
export const adminPasswordSchema = z.object({ passwordKey: passwordKeySchema });

export const listNameSchema = z.object({ name: z.string().trim().min(1).max(MAX_LIST_NAME) });

export const addMemberSchema = z.object({ username: usernameSchema });

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

/** Como o item estava na lista na hora de finalizar. */
export const purchasedItemSchema = z.object({
  text: z.string().trim().min(1).max(MAX_ITEM_TEXT),
  quantity: z.number().int().min(1).max(MAX_QUANTITY),
  category: categoryName,
  done: z.boolean(),
});

/** Compra finalizada. O valor fica em centavos para não haver erro de arredondamento. */
export const purchaseSchema = z
  .object({
    id: z.uuid(),
    ...paymentFields,
    itemCount: z.number().int().min(0).max(MAX_BATCH),
    memberName: z.string().max(MAX_NAME),
    createdAt: z.iso.datetime({ offset: true }),
    // Versões anteriores do app não mandam a lista; vira lista vazia.
    items: z.array(purchasedItemSchema).max(MAX_BATCH).default([]),
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
export type PurchasedItem = z.infer<typeof purchasedItemSchema>;

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
  | { kind: "updatePurchase"; id: string; payment: Payment }
  | { kind: "deletePurchase"; id: string }
  | { kind: "restorePurchase"; purchase: Purchase };

export type Role = "admin" | "member";

export interface UserInfo {
  id: string;
  username: string;
  displayName: string;
  /** Vê todas as contas e listas e redefine senhas. Só o comando do servidor dá esse papel. */
  isSuperAdmin?: boolean;
}

export interface ListSummary {
  id: string;
  name: string;
  role: Role;
}

/** Resposta de /auth/me para quem está logado. */
export interface MeResponse {
  user: UserInfo;
  lists: ListSummary[];
}

/** Visão do administrador geral. */
export interface AdminUser {
  id: string;
  username: string;
  displayName: string;
  isSuperAdmin: boolean;
  createdAt: string;
  lastSeenAt: string | null;
  lockedUntil: string | null;
  devices: number;
}

export interface AdminList {
  id: string;
  name: string;
  createdAt: string;
  items: number;
  members: { userId: string; displayName: string; role: Role }[];
}

export interface AdminOverview {
  users: AdminUser[];
  lists: AdminList[];
}

export interface ListMember {
  userId: string;
  username: string;
  displayName: string;
  role: Role;
  joinedAt: string;
}
