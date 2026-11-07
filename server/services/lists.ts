import type { Item, Payment, Purchase, Snapshot } from "../../shared/contract.ts";
import { type Database, FAMILY_LIST } from "../db/database.ts";

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

/** Todo método recebe a família da sessão, nunca um id de lista vindo do cliente. */
export class ListService {
  private db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  async snapshot(familyId: string): Promise<Snapshot> {
    const [items, categories, purchases] = await Promise.all([
      this.db
        .prepare(
          `SELECT id, text, quantity, done, category, created_at AS createdAt
           FROM items WHERE list_id = ${FAMILY_LIST} ORDER BY created_at`,
        )
        .bind(familyId)
        .all<ItemRow>(),
      this.db
        .prepare(`SELECT name FROM categories WHERE list_id = ${FAMILY_LIST} ORDER BY created_at`)
        .bind(familyId)
        .all<{ name: string }>(),
      this.db
        .prepare(
          `SELECT id, amount_cents AS amountCents, method, installments, item_count AS itemCount,
             member_name AS memberName, created_at AS createdAt, items
           FROM purchases WHERE list_id = ${FAMILY_LIST} AND deleted_at IS NULL
           ORDER BY created_at DESC LIMIT ${RECENT_PURCHASES}`,
        )
        .bind(familyId)
        .all<PurchaseRow>(),
    ]);

    return {
      items: items.results.map((item) => ({ ...item, done: item.done === 1 })),
      customCategories: categories.results.map((category) => category.name),
      purchases: purchases.results.map((row) => ({ ...row, items: parseItems(row.items) })),
    };
  }

  async upsertItems(familyId: string, items: Item[]) {
    const statement = this.db.prepare(
      `INSERT INTO items (list_id, id, text, quantity, done, category, created_at)
       VALUES (${FAMILY_LIST}, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (list_id, id) DO UPDATE SET
         text = excluded.text,
         quantity = excluded.quantity,
         done = excluded.done,
         category = excluded.category`,
    );
    await this.db.batch(
      items.map((item) =>
        statement.bind(
          familyId,
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

  async deleteItems(familyId: string, ids: string[]) {
    const statement = this.db.prepare(`DELETE FROM items WHERE list_id = ${FAMILY_LIST} AND id = ?`);
    await this.db.batch(ids.map((id) => statement.bind(familyId, id)));
  }

  /**
   * Registra a compra e tira os itens numa transação só. Repetir o envio
   * (fila offline) não duplica a compra nem apaga itens novos.
   */
  async finish(familyId: string, memberName: string, purchase: Purchase, itemIds: string[]) {
    const remove = this.db.prepare(`DELETE FROM items WHERE list_id = ${FAMILY_LIST} AND id = ?`);
    await this.db.batch([
      this.db
        .prepare(
          `INSERT INTO purchases
             (list_id, id, amount_cents, method, installments, item_count, member_name, created_at, items)
           VALUES (${FAMILY_LIST}, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT DO NOTHING`,
        )
        .bind(
          familyId,
          purchase.id,
          purchase.amountCents,
          purchase.method,
          purchase.installments,
          purchase.itemCount,
          memberName,
          purchase.createdAt,
          JSON.stringify(purchase.items),
        ),
      ...itemIds.map((id) => remove.bind(familyId, id)),
    ]);
  }

  /** Devolve false se a compra não existe nesta família. */
  async updatePurchase(familyId: string, id: string, payment: Payment): Promise<boolean> {
    const { meta } = await this.db
      .prepare(
        `UPDATE purchases SET amount_cents = ?, method = ?, installments = ?
         WHERE list_id = ${FAMILY_LIST} AND id = ?`,
      )
      .bind(payment.amountCents, payment.method, payment.installments, familyId, id)
      .run();
    return meta.changes > 0;
  }

  /** Marca a compra como excluída. Repetir não tem efeito; outra família não alcança a linha. */
  async deletePurchase(familyId: string, id: string) {
    await this.db
      .prepare(
        `UPDATE purchases SET deleted_at = ?
         WHERE list_id = ${FAMILY_LIST} AND id = ? AND deleted_at IS NULL`,
      )
      .bind(new Date().toISOString(), familyId, id)
      .run();
  }

  /** Desfaz a exclusão: a compra volta exatamente como era. */
  async restorePurchase(familyId: string, id: string) {
    await this.db
      .prepare(`UPDATE purchases SET deleted_at = NULL WHERE list_id = ${FAMILY_LIST} AND id = ?`)
      .bind(familyId, id)
      .run();
  }

  async addCategory(familyId: string, name: string) {
    await this.db
      .prepare(
        `INSERT INTO categories (list_id, name, created_at) VALUES (${FAMILY_LIST}, ?, ?)
         ON CONFLICT DO NOTHING`,
      )
      .bind(familyId, name, new Date().toISOString())
      .run();
  }
}
