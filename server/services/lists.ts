import type { Item, ListSummary, Payment, Purchase, Snapshot } from "../../shared/contract.ts";
import type { Database } from "../db/database.ts";
import { ReceiptService } from "./receipts.ts";
import { generateToken, hashToken } from "./tokens.ts";

interface ItemRow {
  id: string;
  text: string;
  quantity: number;
  done: number;
  category: string;
  createdAt: string;
}

const RECENT_PURCHASES = 50;

type PurchaseRow = Omit<Purchase, "items"> & { items: string };

function parseItems(json: string): Purchase["items"] {
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Dados de uma lista. Quem chama já conferiu que a pessoa participa da lista
 * (middleware requireListAccess); todo comando filtra pelo id da lista.
 */
export class ListService {
  private db: Database;
  private receipts: ReceiptService;

  constructor(db: Database) {
    this.db = db;
    this.receipts = new ReceiptService(db);
  }

  /** Cria a lista com quem criou como administrador. */
  async create(userId: string, name: string): Promise<ListSummary> {
    const familyId = crypto.randomUUID();
    const listId = crypto.randomUUID();
    const now = new Date().toISOString();
    // families é só um registro interno 1:1 com a lista (lists.family_id é obrigatório).
    await this.db.batch([
      this.db
        .prepare(
          "INSERT INTO families (id, name, invite_hash, created_at, open_join) VALUES (?, ?, ?, ?, 0)",
        )
        .bind(familyId, name, await hashToken(generateToken()), now),
      this.db
        .prepare("INSERT INTO lists (id, family_id, name, created_at) VALUES (?, ?, ?, ?)")
        .bind(listId, familyId, name, now),
      this.db
        .prepare("INSERT INTO list_members (list_id, user_id, role, joined_at) VALUES (?, ?, 'admin', ?)")
        .bind(listId, userId, now),
    ]);
    return { id: listId, name, role: "admin" };
  }

  async rename(listId: string, name: string) {
    await this.db.prepare("UPDATE lists SET name = ? WHERE id = ?").bind(name, listId).run();
  }

  /** Apaga a lista com itens, categorias, compras e participantes. */
  async delete(listId: string) {
    const list = await this.db
      .prepare("SELECT family_id AS familyId FROM lists WHERE id = ?")
      .bind(listId)
      .first<{ familyId: string }>();
    if (!list) return;
    await this.db.batch([
      this.db.prepare("DELETE FROM lists WHERE id = ?").bind(listId),
      this.db
        .prepare(
          "DELETE FROM families WHERE id = ? AND NOT EXISTS (SELECT 1 FROM lists WHERE family_id = ?)",
        )
        .bind(list.familyId, list.familyId),
    ]);
  }

  async snapshot(listId: string): Promise<Snapshot> {
    const [items, categories, purchases] = await Promise.all([
      this.db
        .prepare(
          `SELECT id, text, quantity, done, category, created_at AS createdAt
           FROM items WHERE list_id = ? ORDER BY created_at`,
        )
        .bind(listId)
        .all<ItemRow>(),
      this.db
        .prepare("SELECT name FROM categories WHERE list_id = ? ORDER BY created_at")
        .bind(listId)
        .all<{ name: string }>(),
      this.db
        .prepare(
          `SELECT id, amount_cents AS amountCents, method, installments, item_count AS itemCount,
             member_name AS memberName, created_at AS createdAt, items
           FROM purchases WHERE list_id = ? AND deleted_at IS NULL
           ORDER BY created_at DESC LIMIT ${RECENT_PURCHASES}`,
        )
        .bind(listId)
        .all<PurchaseRow>(),
    ]);

    const receipts = await this.receipts.forPurchases(
      listId,
      purchases.results.map((row) => row.id),
    );
    return {
      items: items.results.map((item) => ({ ...item, done: item.done === 1 })),
      customCategories: categories.results.map((category) => category.name),
      purchases: purchases.results.map((row) => ({
        ...row,
        items: parseItems(row.items),
        receipt: receipts.get(row.id) ?? null,
      })),
    };
  }

  async upsertItems(listId: string, items: Item[]) {
    const statement = this.db.prepare(
      `INSERT INTO items (list_id, id, text, quantity, done, category, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (list_id, id) DO UPDATE SET
         text = excluded.text,
         quantity = excluded.quantity,
         done = excluded.done,
         category = excluded.category`,
    );
    await this.db.batch(
      items.map((item) =>
        statement.bind(
          listId,
          item.id,
          item.text,
          item.quantity,
          item.done ? 1 : 0,
          item.category,
          item.createdAt,
        ),
      ),
    );
  }

  async deleteItems(listId: string, ids: string[]) {
    const statement = this.db.prepare("DELETE FROM items WHERE list_id = ? AND id = ?");
    await this.db.batch(ids.map((id) => statement.bind(listId, id)));
  }

  /**
   * Registra a compra e tira os itens numa transação só. Repetir o envio
   * (fila offline) não duplica a compra nem apaga itens novos.
   */
  async finish(listId: string, memberName: string, purchase: Purchase, itemIds: string[]) {
    const remove = this.db.prepare("DELETE FROM items WHERE list_id = ? AND id = ?");
    await this.db.batch([
      this.db
        .prepare(
          `INSERT INTO purchases
             (list_id, id, amount_cents, method, installments, item_count, member_name, created_at, items)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT DO NOTHING`,
        )
        .bind(
          listId,
          purchase.id,
          purchase.amountCents,
          purchase.method,
          purchase.installments,
          purchase.itemCount,
          memberName,
          purchase.createdAt,
          JSON.stringify(purchase.items),
        ),
      ...itemIds.map((id) => remove.bind(listId, id)),
    ]);
  }

  /** Devolve false se a compra não existe nesta lista. */
  async updatePurchase(listId: string, id: string, payment: Payment): Promise<boolean> {
    const { meta } = await this.db
      .prepare(
        `UPDATE purchases SET amount_cents = ?, method = ?, installments = ?
         WHERE list_id = ? AND id = ?`,
      )
      .bind(payment.amountCents, payment.method, payment.installments, listId, id)
      .run();
    return meta.changes > 0;
  }

  /** Marca a compra como excluída. Repetir não tem efeito; outra lista não alcança a linha. */
  async deletePurchase(listId: string, id: string) {
    await this.db
      .prepare(
        "UPDATE purchases SET deleted_at = ? WHERE list_id = ? AND id = ? AND deleted_at IS NULL",
      )
      .bind(new Date().toISOString(), listId, id)
      .run();
  }

  /** Desfaz a exclusão: a compra volta exatamente como era. */
  async restorePurchase(listId: string, id: string) {
    await this.db
      .prepare("UPDATE purchases SET deleted_at = NULL WHERE list_id = ? AND id = ?")
      .bind(listId, id)
      .run();
  }

  async addCategory(listId: string, name: string) {
    await this.db
      .prepare(
        "INSERT INTO categories (list_id, name, created_at) VALUES (?, ?, ?) ON CONFLICT DO NOTHING",
      )
      .bind(listId, name, new Date().toISOString())
      .run();
  }
}
