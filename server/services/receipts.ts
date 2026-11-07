import type { Receipt, ReceiptItem } from "../../shared/contract.ts";
import type { Database } from "../db/database.ts";

/** Leituras de foto por lista e por dia: a cota grátis da IA é da conta toda. */
export const DAILY_READS_PER_LIST = 30;

interface ReceiptRow {
  purchaseId: string;
  accessKey: string | null;
  storeName: string;
  cnpj: string | null;
  issuedOn: string | null;
  totalCents: number | null;
  source: Receipt["source"];
  readAt: string;
}

type ItemRow = ReceiptItem & { purchaseId: string };

export type SaveResult =
  | { ok: true }
  | { ok: false; reason: "purchase" }
  | { ok: false; reason: "duplicate"; purchaseCreatedAt: string };

/** Cupons fiscais das compras. Quem chama já conferiu o acesso à lista. */
export class ReceiptService {
  private db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  /**
   * Liga (ou substitui) o cupom de uma compra. Repetir o envio dá o mesmo resultado.
   * Recusa se a compra não existe ou se o mesmo cupom já está em outra compra da lista.
   */
  async save(listId: string, purchaseId: string, receipt: Receipt): Promise<SaveResult> {
    const purchase = await this.db
      .prepare("SELECT items FROM purchases WHERE list_id = ? AND id = ? AND deleted_at IS NULL")
      .bind(listId, purchaseId)
      .first<{ items: string }>();
    if (!purchase) return { ok: false, reason: "purchase" };

    if (receipt.accessKey) {
      const other = await this.db
        .prepare(
          `SELECT p.created_at AS createdAt FROM receipts r
           JOIN purchases p ON p.list_id = r.list_id AND p.id = r.purchase_id
           WHERE r.list_id = ? AND r.access_key = ? AND r.purchase_id <> ?`,
        )
        .bind(listId, receipt.accessKey, purchaseId)
        .first<{ createdAt: string }>();
      if (other) return { ok: false, reason: "duplicate", purchaseCreatedAt: other.createdAt };
    }

    // A ligação só vale para itens que existem na lista desta compra.
    let listSize = 0;
    try {
      const parsed = JSON.parse(purchase.items);
      listSize = Array.isArray(parsed) ? parsed.length : 0;
    } catch {
      listSize = 0;
    }

    const insertItem = this.db.prepare(
      `INSERT INTO receipt_items
         (list_id, purchase_id, position, code, description, quantity, unit, unit_cents, total_cents, list_index)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    await this.db.batch([
      this.db.prepare("DELETE FROM receipts WHERE list_id = ? AND purchase_id = ?").bind(listId, purchaseId),
      this.db
        .prepare(
          `INSERT INTO receipts
             (list_id, purchase_id, access_key, store_name, cnpj, issued_on, total_cents, source, read_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          listId,
          purchaseId,
          receipt.accessKey,
          receipt.storeName,
          receipt.cnpj,
          receipt.issuedOn,
          receipt.totalCents,
          receipt.source,
          receipt.readAt,
        ),
      ...receipt.items.map((item, position) =>
        insertItem.bind(
          listId,
          purchaseId,
          position,
          item.code,
          item.description,
          item.quantity,
          item.unit,
          item.unitCents,
          item.totalCents,
          item.listIndex !== null && item.listIndex < listSize ? item.listIndex : null,
        ),
      ),
    ]);
    return { ok: true };
  }

  async remove(listId: string, purchaseId: string) {
    await this.db
      .prepare("DELETE FROM receipts WHERE list_id = ? AND purchase_id = ?")
      .bind(listId, purchaseId)
      .run();
  }

  /** Cupons das compras pedidas, prontos para entrar no snapshot. */
  async forPurchases(listId: string, purchaseIds: string[]): Promise<Map<string, Receipt>> {
    const receipts = new Map<string, Receipt>();
    if (purchaseIds.length === 0) return receipts;
    const wanted = new Set(purchaseIds);

    const [rows, items] = await Promise.all([
      this.db
        .prepare(
          `SELECT purchase_id AS purchaseId, access_key AS accessKey, store_name AS storeName, cnpj,
             issued_on AS issuedOn, total_cents AS totalCents, source, read_at AS readAt
           FROM receipts WHERE list_id = ?`,
        )
        .bind(listId)
        .all<ReceiptRow>(),
      this.db
        .prepare(
          `SELECT purchase_id AS purchaseId, code, description, quantity, unit,
             unit_cents AS unitCents, total_cents AS totalCents, list_index AS listIndex
           FROM receipt_items WHERE list_id = ? ORDER BY purchase_id, position`,
        )
        .bind(listId)
        .all<ItemRow>(),
    ]);

    for (const { purchaseId, ...receipt } of rows.results) {
      if (wanted.has(purchaseId)) receipts.set(purchaseId, { ...receipt, items: [] });
    }
    for (const { purchaseId, ...item } of items.results) {
      receipts.get(purchaseId)?.items.push(item);
    }
    return receipts;
  }

  /** Conta uma leitura de foto. Devolve false quando a lista já usou as leituras do dia. */
  async countRead(listId: string, now = new Date()): Promise<boolean> {
    const day = now.toISOString().slice(0, 10);
    const row = await this.db
      .prepare(
        `INSERT INTO receipt_reads (day, list_id, count) VALUES (?, ?, 1)
         ON CONFLICT (day, list_id) DO UPDATE SET count = count + 1
         RETURNING count`,
      )
      .bind(day, listId)
      .first<{ count: number }>();
    return (row?.count ?? 1) <= DAILY_READS_PER_LIST;
  }
}
