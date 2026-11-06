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

export const joinSchema = z.object({
  inviteToken: z.string().regex(/^[0-9a-f]{64}$/),
  name: z.string().trim().min(1).max(MAX_NAME),
});

export type Item = z.infer<typeof itemSchema>;

export interface Snapshot {
  items: Item[];
  customCategories: string[];
}

/** Alteração unitária e idempotente: pode ser reenviada sem efeito colateral. */
export type Op =
  | { kind: "upsert"; items: Item[] }
  | { kind: "delete"; ids: string[] }
  | { kind: "addCategory"; name: string };

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
