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

/** Código do link de convite (hexadecimal de 128 bits). */
export const inviteCodeSchema = z.string().regex(/^[0-9a-f]{32}$/);

export const MAX_INSTALLMENTS = 24;
export const MAX_AMOUNT_CENTS = 100_000_000;
/** Quantas compras recentes vêm no snapshot. O total de meses mais antigos vem de /months. */
export const RECENT_PURCHASES = 50;

const onlyCreditSplits = {
  check: (payment: { method: string; installments: number }) =>
    payment.method === "credito" || payment.installments === 1,
  message: "Só o crédito pode ser parcelado",
};

/** Valor e forma de pagamento: o que dá para corrigir depois. */
export const MAX_STORE = 60;

const paymentFields = {
  amountCents: z.number().int().min(1).max(MAX_AMOUNT_CENTS),
  method: z.enum(["pix", "dinheiro", "debito", "credito"]),
  installments: z.number().int().min(1).max(MAX_INSTALLMENTS),
  /** Mercado da compra, como a pessoa escreveu. Ausente: não muda (ou vazio, numa compra nova). */
  store: z.string().trim().max(MAX_STORE).optional(),
};

export const MAX_BRAND = 40;

/** De onde veio o preço de um item: digitado, do cupom fiscal ou (no futuro) do código de barras. */
export const priceSourceSchema = z.enum(["manual", "cupom", "codigo"]);

/** Como o item estava na lista na hora de finalizar, mais o preço e a marca informados depois. */
export const purchasedItemSchema = z.object({
  text: z.string().trim().min(1).max(MAX_ITEM_TEXT),
  quantity: z.number().int().min(1).max(MAX_QUANTITY),
  category: categoryName,
  done: z.boolean(),
  /** Preço de cada unidade, em centavos. Ausente ou null: ainda sem preço. */
  unitCents: z.number().int().min(0).max(MAX_AMOUNT_CENTS).nullable().optional(),
  brand: z.string().trim().max(MAX_BRAND).optional(),
  priceSource: priceSourceSchema.optional(),
  /** Código de barras (EAN), para a leitura futura pelo código. */
  code: z.string().trim().max(20).optional(),
});

/** Preço e marca de um item da compra (pela posição em purchase.items). */
export const itemPriceSchema = z.object({
  index: z.number().int().min(0).max(MAX_BATCH),
  unitCents: z.number().int().min(0).max(MAX_AMOUNT_CENTS).nullable(),
  brand: z.string().trim().max(MAX_BRAND),
  priceSource: priceSourceSchema.default("manual"),
  code: z.string().trim().max(20).optional(),
});

/**
 * Edita preços e marcas dos itens de uma compra. amountCents, quando vem, passa a ser
 * o valor da compra (a pessoa escolheu usar a soma dos preços).
 */
export const updatePricesSchema = z.object({
  prices: z.array(itemPriceSchema).max(MAX_BATCH),
  amountCents: z.number().int().min(1).max(MAX_AMOUNT_CENTS).nullable(),
});

export const MAX_RECEIPT_ITEMS = 300;

/** Uma linha do cupom fiscal (NFC-e), já ligada ou não a um item da lista da compra. */
export const receiptItemSchema = z.object({
  /** Código de barras (EAN) ou código interno da loja. */
  code: z.string().trim().max(20),
  description: z.string().trim().min(1).max(120),
  /** Pode ter casas decimais: 0,835 kg. */
  quantity: z.number().positive().max(100_000),
  unit: z.string().trim().max(6),
  unitCents: z.number().int().min(0).max(MAX_AMOUNT_CENTS),
  totalCents: z.number().int().min(0).max(MAX_AMOUNT_CENTS),
  /** Posição do item em purchase.items que corresponde a esta linha; null quando veio fora da lista. */
  listIndex: z.number().int().min(0).max(MAX_BATCH).nullable(),
});

/** Cupom fiscal lido por foto ou QR code e ligado a uma compra. A foto não é guardada. */
export const receiptSchema = z.object({
  /** Chave de acesso de 44 dígitos (vem do QR code); impede ler o mesmo cupom duas vezes. */
  accessKey: z.string().regex(/^\d{44}$/).nullable(),
  storeName: z.string().trim().max(120),
  cnpj: z.string().regex(/^\d{14}$/).nullable(),
  /** Data da compra no cupom, AAAA-MM-DD. */
  issuedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  totalCents: z.number().int().min(0).max(MAX_AMOUNT_CENTS).nullable(),
  source: z.enum(["foto", "qrcode"]),
  readAt: z.iso.datetime({ offset: true }),
  items: z.array(receiptItemSchema).max(MAX_RECEIPT_ITEMS),
});

/** O que a leitura da foto devolve, antes de a pessoa revisar as ligações. */
export interface ReceiptReading {
  storeName: string;
  cnpj: string | null;
  issuedOn: string | null;
  totalCents: number | null;
  items: Omit<ReceiptItem, "listIndex">[];
}

export const readReceiptSchema = z.object({
  /** JPEG em base64, já reduzido no aparelho. */
  image: z.string().min(100).max(6_000_000).regex(/^[A-Za-z0-9+/=]+$/),
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
    /** Cupom fiscal ligado à compra; só o servidor preenche, pela rota do cupom. */
    receipt: receiptSchema.nullable().optional(),
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

export const MAX_TEMPLATES = 30;

/** Item de um modelo de lista: sem preço; o preço antigo aparece só como referência. */
export const templateItemSchema = z.object({
  text: z.string().trim().min(1).max(MAX_ITEM_TEXT),
  quantity: z.number().int().min(1).max(MAX_QUANTITY),
  category: categoryName,
});

/** Lista padrão reutilizável ("Compra do mês", "Feira da semana"). */
export const templateSchema = z.object({
  id: z.uuid(),
  name: z.string().trim().min(1).max(MAX_LIST_NAME),
  items: z.array(templateItemSchema).max(MAX_BATCH),
  /** No máximo um modelo da lista é o padrão. */
  isDefault: z.boolean(),
  updatedAt: z.iso.datetime({ offset: true }),
});

/** Total gasto num mês (AAAA-MM, no horário de Brasília). */
export interface MonthTotal {
  month: string;
  totalCents: number;
  count: number;
}

/** Quantos códigos aprendidos vêm no snapshot (os mais recentes). */
export const MAX_BARCODES = 1000;

/** Código de barras (EAN e UPC, só os dígitos e sem zeros à esquerda) com o produto que ele representa. */
export const barcodeSchema = z.object({
  code: z.string().regex(/^[1-9]\d{4,13}$/),
  text: z.string().trim().min(1).max(MAX_ITEM_TEXT),
  category: categoryName,
});

export type Item = z.infer<typeof itemSchema>;
export type Purchase = z.infer<typeof purchaseSchema>;
export type PaymentMethod = Purchase["method"];
export type Payment = z.infer<typeof paymentSchema>;
export type PurchasedItem = z.infer<typeof purchasedItemSchema>;
export type Receipt = z.infer<typeof receiptSchema>;
export type ReceiptItem = z.infer<typeof receiptItemSchema>;
export type ItemPrice = z.input<typeof itemPriceSchema>;
export type PriceSource = z.infer<typeof priceSourceSchema>;
export type Template = z.infer<typeof templateSchema>;
export type Barcode = z.infer<typeof barcodeSchema>;
export type TemplateItem = z.infer<typeof templateItemSchema>;

export interface Snapshot {
  items: Item[];
  customCategories: string[];
  /** Compras mais recentes primeiro. */
  purchases: Purchase[];
  /** Modelos de lista, em ordem de nome. */
  templates: Template[];
  /** Códigos de barras que a lista já aprendeu. */
  barcodes: Barcode[];
}

/** Alteração unitária e idempotente: pode ser reenviada sem efeito colateral. */
export type Op =
  | { kind: "upsert"; items: Item[] }
  | { kind: "delete"; ids: string[] }
  | { kind: "addCategory"; name: string }
  | { kind: "finish"; purchase: Purchase; itemIds: string[] }
  | { kind: "updatePurchase"; id: string; payment: Payment }
  | { kind: "deletePurchase"; id: string }
  | { kind: "restorePurchase"; purchase: Purchase }
  | { kind: "setReceipt"; purchaseId: string; receipt: Receipt }
  | { kind: "removeReceipt"; purchaseId: string }
  | { kind: "updatePrices"; purchaseId: string; prices: ItemPrice[]; amountCents: number | null }
  | { kind: "upsertTemplate"; template: Template }
  | { kind: "deleteTemplate"; id: string }
  | { kind: "learnBarcode"; barcode: Barcode };

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

/** O link de convite de uma lista. */
export interface ListInvite {
  code: string;
}

/** O que quem abriu o link vê antes de entrar. */
export interface InvitePreview {
  listName: string;
}

export interface ListMember {
  userId: string;
  username: string;
  displayName: string;
  role: Role;
  joinedAt: string;
}
