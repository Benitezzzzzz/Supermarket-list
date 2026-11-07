import type { Item, Snapshot } from "../../shared/contract.ts";
import { type Database, FAMILY_LIST } from "../db/database.ts";

interface ItemRow {
  id: string;
  text: string;
  quantity: number;
  done: number;
  category: string;
  createdAt: string;
}

/** Todo método recebe a família da sessão, nunca um id de lista vindo do cliente. */
export class ListService {
  private db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  async snapshot(familyId: string): Promise<Snapshot> {
    const [items, categories] = await Promise.all([
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
    ]);

    return {
      items: items.results.map((item) => ({ ...item, done: item.done === 1 })),
      customCategories: categories.results.map((category) => category.name),
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
