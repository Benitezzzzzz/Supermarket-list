import type { ListMember, ListSummary, Role } from "../../shared/contract.ts";
import type { Database } from "../db/database.ts";

export type AddResult = { ok: true; member: ListMember } | { ok: false; reason: "not_found" | "already" };

/** Quem participa de qual lista. É a única fonte de permissão para os dados de uma lista. */
export class MembershipService {
  private db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  async role(listId: string, userId: string): Promise<Role | null> {
    const row = await this.db
      .prepare("SELECT role FROM list_members WHERE list_id = ? AND user_id = ?")
      .bind(listId, userId)
      .first<{ role: Role }>();
    return row?.role ?? null;
  }

  async listsOf(userId: string): Promise<ListSummary[]> {
    const { results } = await this.db
      .prepare(
        `SELECT l.id, l.name, m.role
         FROM list_members m JOIN lists l ON l.id = m.list_id
         WHERE m.user_id = ? ORDER BY m.joined_at`,
      )
      .bind(userId)
      .all<ListSummary>();
    return results;
  }

  async members(listId: string): Promise<ListMember[]> {
    const { results } = await this.db
      .prepare(
        `SELECT u.id AS userId, u.username, u.display_name AS displayName, m.role, m.joined_at AS joinedAt
         FROM list_members m JOIN users u ON u.id = m.user_id
         WHERE m.list_id = ? ORDER BY m.joined_at`,
      )
      .bind(listId)
      .all<ListMember>();
    return results;
  }

  /** O administrador adiciona alguém que já tem conta, pelo nome de usuário. */
  async add(listId: string, username: string): Promise<AddResult> {
    const user = await this.db
      .prepare("SELECT id, username, display_name AS displayName FROM users WHERE username = ?")
      .bind(username)
      .first<{ id: string; username: string; displayName: string }>();
    if (!user) return { ok: false, reason: "not_found" };
    if (await this.role(listId, user.id)) return { ok: false, reason: "already" };

    const joinedAt = new Date().toISOString();
    await this.db
      .prepare("INSERT INTO list_members (list_id, user_id, role, joined_at) VALUES (?, ?, 'member', ?)")
      .bind(listId, user.id, joinedAt)
      .run();
    return {
      ok: true,
      member: { userId: user.id, username: user.username, displayName: user.displayName, role: "member", joinedAt },
    };
  }

  async remove(listId: string, userId: string): Promise<boolean> {
    const { meta } = await this.db
      .prepare("DELETE FROM list_members WHERE list_id = ? AND user_id = ?")
      .bind(listId, userId)
      .run();
    return meta.changes > 0;
  }
}
