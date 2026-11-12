import type { ListMember, ListSummary, Role } from "../../shared/contract.ts";
import type { Database } from "../db/database.ts";
import { generateInviteCode } from "./tokens.ts";

export interface JoinResult {
  list: ListSummary;
  /** false quando a pessoa já participava. */
  joined: boolean;
}

/** Quem participa de qual lista. É a única fonte de permissão para os dados de uma lista. */
export class MembershipService {
  private db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  async exists(listId: string): Promise<boolean> {
    return (await this.db.prepare("SELECT 1 AS x FROM lists WHERE id = ?").bind(listId).first()) !== null;
  }

  async role(listId: string, userId: string): Promise<Role | null> {
    const row = await this.db
      .prepare("SELECT role FROM list_members WHERE list_id = ? AND user_id = ?")
      .bind(listId, userId)
      .first<{ role: Role }>();
    return row?.role ?? null;
  }

  /** Na ordem em que a pessoa entrou; rowid desempata entradas no mesmo milissegundo. */
  async listsOf(userId: string): Promise<ListSummary[]> {
    const { results } = await this.db
      .prepare(
        `SELECT l.id, l.name, m.role
         FROM list_members m JOIN lists l ON l.id = m.list_id
         WHERE m.user_id = ? ORDER BY m.joined_at, m.rowid`,
      )
      .bind(userId)
      .all<ListSummary>();
    return results;
  }

/**
   * O administrador geral vê todas as listas. Nas que ele não participa,
   * entra como administrador; as dele vêm primeiro.
   */
  async allLists(userId: string): Promise<ListSummary[]> {
    const { results } = await this.db
      .prepare(
        `SELECT l.id, l.name, coalesce(m.role, 'admin') AS role
         FROM lists l LEFT JOIN list_members m ON m.list_id = l.id AND m.user_id = ?
         ORDER BY m.user_id IS NULL, m.joined_at, l.created_at, l.rowid`,
      )
      .bind(userId)
      .all<ListSummary>();
    return results;
  }

  /** Quem administra primeiro, depois na ordem de entrada. */
  async members(listId: string): Promise<ListMember[]> {
    const { results } = await this.db
      .prepare(
        `SELECT u.id AS userId, u.username, u.display_name AS displayName, m.role, m.joined_at AS joinedAt
         FROM list_members m JOIN users u ON u.id = m.user_id
         WHERE m.list_id = ? ORDER BY m.role = 'admin' DESC, m.joined_at, m.rowid`,
      )
      .bind(listId)
      .all<ListMember>();
    return results;
  }

  /** Código do link de convite; listas antigas sem código ganham um na hora. */
  async inviteCode(listId: string): Promise<string> {
    const row = await this.db
      .prepare("SELECT invite_code AS code FROM lists WHERE id = ?")
      .bind(listId)
      .first<{ code: string | null }>();
    return row?.code ?? this.resetInvite(listId);
  }

  /** Gera um código novo: o link antigo para de funcionar. */
  async resetInvite(listId: string): Promise<string> {
    const code = generateInviteCode();
    await this.db.prepare("UPDATE lists SET invite_code = ? WHERE id = ?").bind(code, listId).run();
    return code;
  }

  /** A lista de um convite, para mostrar o nome antes de entrar. */
  async findInvite(code: string): Promise<{ id: string; name: string } | null> {
    return this.db
      .prepare("SELECT id, name FROM lists WHERE invite_code = ?")
      .bind(code)
      .first<{ id: string; name: string }>();
  }

  /** Entra na lista pelo convite. Quem já participa continua com o mesmo papel. */
  async join(code: string, userId: string): Promise<JoinResult | null> {
    const list = await this.findInvite(code);
    if (!list) return null;
    const role = await this.role(list.id, userId);
    if (role) return { list: { ...list, role }, joined: false };
    await this.db
      .prepare("INSERT OR IGNORE INTO list_members (list_id, user_id, role, joined_at) VALUES (?, ?, 'member', ?)")
      .bind(list.id, userId, new Date().toISOString())
      .run();
    return { list: { ...list, role: "member" }, joined: true };
  }

  async remove(listId: string, userId: string): Promise<boolean> {
    const { meta } = await this.db
      .prepare("DELETE FROM list_members WHERE list_id = ? AND user_id = ?")
      .bind(listId, userId)
      .run();
    return meta.changes > 0;
  }
}
