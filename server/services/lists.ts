import type { Item, Snapshot } from "../../shared/contract.ts";
import { type Database, transaction } from "../db/database.ts";

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

  private listId(familyId: string): string {
    const row = this.db
      .prepare("SELECT id FROM lists WHERE family_id = ? ORDER BY created_at LIMIT 1")
      .get(familyId) as { id: string } | undefined;
    if (!row) throw new Error(`Família ${familyId} sem lista`);
    return row.id;
  }

  snapshot(familyId: string): Snapshot {
    const listId = this.listId(familyId);
    const items = this.db
      .prepare(
        `SELECT id, text, quantity, done, category, created_at AS createdAt
         FROM items WHERE list_id = ? ORDER BY created_at`,
      )
      .all(listId) as unknown as ItemRow[];
    const categories = this.db
      .prepare("SELECT name FROM categories WHERE list_id = ? ORDER BY created_at")
      .all(listId) as unknown as { name: string }[];

    return {
      items: items.map((item) => ({ ...item, done: item.done === 1 })),
      customCategories: categories.map((category) => category.name),
    };
  }

  upsertItems(familyId: string, items: Item[]) {
    const listId = this.listId(familyId);
    const statement = this.db.prepare(
      `INSERT INTO items (list_id, id, text, quantity, done, category, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (list_id, id) DO UPDATE SET
         text = excluded.text,
         quantity = excluded.quantity,
         done = excluded.done,
         category = excluded.category`,
    );
    transaction(this.db, () => {
      for (const item of items) {
        statement.run(
          listId,
          item.id,
          item.text,
          item.quantity,
          item.done ? 1 : 0,
          item.category,
          item.createdAt,
        );
      }
    });
  }

  deleteItems(familyId: string, ids: string[]) {
    const listId = this.listId(familyId);
    const statement = this.db.prepare("DELETE FROM items WHERE list_id = ? AND id = ?");
    transaction(this.db, () => {
      for (const id of ids) statement.run(listId, id);
    });
  }

  addCategory(familyId: string, name: string) {
    this.db
      .prepare(
        `INSERT INTO categories (list_id, name, created_at) VALUES (?, ?, ?)
         ON CONFLICT DO NOTHING`,
      )
      .run(this.listId(familyId), name, new Date().toISOString());
  }
}
