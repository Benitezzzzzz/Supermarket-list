import {
  type Barcode,
  type Item,
  MAX_BARCODES,
  type ItemPrice,
  type ListSummary,
  MAX_TEMPLATES,
  type MonthTotal,
  type Payment,
  type Purchase,
  RECENT_PURCHASES,
  type Snapshot,
  type Template,
} from "../../shared/contract.ts";
import { applyPrices } from "../../shared/prices.ts";
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

/** Meses no resumo de /months. */
const MONTHS_BACK = 24;
/** Os meses são contados no horário de Brasília (João Pessoa não tem horário de verão). */
const BRAZIL_OFFSET = "-3 hours";

type PurchaseRow = Omit<Purchase, "items"> & { items: string };
type TemplateRow = Omit<Template, "items" | "isDefault"> & { items: string; isDefault: number };

function parseArray<T>(json: string): T[] {
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

const parseItems = (json: string) => parseArray<Purchase["items"][number]>(json);

export type TemplateResult = { ok: true } | { ok: false; reason: "limit" };

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
    const [items, categories, purchases, templates, barcodes] = await Promise.all([
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
      this.db
        .prepare(
          `SELECT id, name, items, is_default AS isDefault, updated_at AS updatedAt
           FROM templates WHERE list_id = ? ORDER BY name COLLATE NOCASE, id`,
        )
        .bind(listId)
        .all<TemplateRow>(),
      this.db
        .prepare(
          `SELECT code, text, category FROM barcodes WHERE list_id = ?
           ORDER BY updated_at DESC LIMIT ${MAX_BARCODES}`,
        )
        .bind(listId)
        .all<Barcode>(),
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
      templates: templates.results.map((row) => ({
        ...row,
        items: parseArray<Template["items"][number]>(row.items),
        isDefault: row.isDefault === 1,
      })),
      barcodes: barcodes.results,
    };
  }

  /** Guarda (ou corrige) o produto de um código de barras. */
  async learnBarcode(listId: string, barcode: Barcode) {
    await this.db
      .prepare(
        `INSERT INTO barcodes (list_id, code, text, category, updated_at) VALUES (?, ?, ?, ?, ?)
         ON CONFLICT (list_id, code) DO UPDATE SET
           text = excluded.text, category = excluded.category, updated_at = excluded.updated_at`,
      )
      .bind(listId, barcode.code, barcode.text, barcode.category, new Date().toISOString())
      .run();
  }

  /** Total e quantidade de compras por mês, dos últimos 24 meses, do mais recente ao mais antigo. */
  async months(listId: string): Promise<MonthTotal[]> {
    const { results } = await this.db
      .prepare(
        `SELECT strftime('%Y-%m', created_at, '${BRAZIL_OFFSET}') AS month,
           SUM(amount_cents) AS totalCents, COUNT(*) AS count
         FROM purchases WHERE list_id = ? AND deleted_at IS NULL
         GROUP BY month ORDER BY month DESC LIMIT ${MONTHS_BACK}`,
      )
      .bind(listId)
      .all<MonthTotal>();
    return results;
  }

  /**
   * Grava preço e marca dos itens de uma compra. Só mexe nas posições informadas;
   * o resto da lista da compra fica como estava. Devolve false se a compra não existe.
   */
  async updatePrices(listId: string, id: string, prices: ItemPrice[], amountCents: number | null): Promise<boolean> {
    const row = await this.db
      .prepare("SELECT items FROM purchases WHERE list_id = ? AND id = ? AND deleted_at IS NULL")
      .bind(listId, id)
      .first<{ items: string }>();
    if (!row) return false;
    const items = JSON.stringify(applyPrices(parseItems(row.items), prices));
    const update =
      amountCents === null
        ? this.db.prepare("UPDATE purchases SET items = ? WHERE list_id = ? AND id = ?").bind(items, listId, id)
        : this.db
            .prepare("UPDATE purchases SET items = ?, amount_cents = ? WHERE list_id = ? AND id = ?")
            .bind(items, amountCents, listId, id);
    await update.run();
    return true;
  }

  /** Cria ou substitui um modelo. Marcar como padrão tira a marca dos outros na mesma transação. */
  async upsertTemplate(listId: string, template: Template): Promise<TemplateResult> {
    const others = await this.db
      .prepare("SELECT COUNT(*) AS n FROM templates WHERE list_id = ? AND id <> ?")
      .bind(listId, template.id)
      .first<{ n: number }>();
    if ((others?.n ?? 0) >= MAX_TEMPLATES) return { ok: false, reason: "limit" };
    const statements = [];
    if (template.isDefault) {
      statements.push(
        this.db.prepare("UPDATE templates SET is_default = 0 WHERE list_id = ? AND id <> ?").bind(listId, template.id),
      );
    }
    statements.push(
      this.db
        .prepare(
          `INSERT INTO templates (list_id, id, name, items, is_default, updated_at) VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT (list_id, id) DO UPDATE SET
             name = excluded.name, items = excluded.items,
             is_default = excluded.is_default, updated_at = excluded.updated_at`,
        )
        .bind(
          listId,
          template.id,
          template.name,
          JSON.stringify(template.items),
          template.isDefault ? 1 : 0,
          template.updatedAt,
        ),
    );
    await this.db.batch(statements);
    return { ok: true };
  }

  async deleteTemplate(listId: string, id: string) {
    await this.db.prepare("DELETE FROM templates WHERE list_id = ? AND id = ?").bind(listId, id).run();
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
