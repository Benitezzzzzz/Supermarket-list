import type { FamilySettings, Member, Role, SessionInfo } from "../../shared/contract.ts";
import type { Database } from "../db/database.ts";
import { generateToken, hashToken } from "./tokens.ts";

export type JoinResult =
  | { ok: true; session: SessionInfo; sessionToken: string }
  | { ok: false; reason: "not_found" | "closed" };

export interface NewFamily {
  familyId: string;
  listId: string;
  inviteToken: string;
}

export class FamilyService {
  private db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  /** Usado pelos testes; em produção a família nasce pelo comando family:create. */
  async create(name: string): Promise<NewFamily> {
    const familyId = crypto.randomUUID();
    const listId = crypto.randomUUID();
    const inviteToken = generateToken();
    const now = new Date().toISOString();

    await this.db.batch([
      this.db
        .prepare("INSERT INTO families (id, name, invite_hash, created_at) VALUES (?, ?, ?, ?)")
        .bind(familyId, name, await hashToken(inviteToken), now),
      this.db
        .prepare("INSERT INTO lists (id, family_id, name, created_at) VALUES (?, ?, ?, ?)")
        .bind(listId, familyId, "Lista do Mercado", now),
    ]);
    return { familyId, listId, inviteToken };
  }

  /** Entrada por convite: só a família daquele código. */
  async join(inviteToken: string, name: string): Promise<JoinResult> {
    const family = await this.db
      .prepare("SELECT id, name, open_join AS openJoin FROM families WHERE invite_hash = ?")
      .bind(await hashToken(inviteToken))
      .first<{ id: string; name: string; openJoin: number }>();
    if (!family) return { ok: false, reason: "not_found" };
    return this.addMember(family, name);
  }

  /**
   * Entrada pelo endereço do app, sem convite. Só funciona quando o app tem uma
   * única família; com várias, não há como saber qual é a da pessoa.
   */
  async joinOpen(name: string): Promise<JoinResult> {
    const { results } = await this.db
      .prepare("SELECT id, name, open_join AS openJoin FROM families LIMIT 2")
      .all<{ id: string; name: string; openJoin: number }>();
    if (results.length !== 1) return { ok: false, reason: "not_found" };
    return this.addMember(results[0], name);
  }

  /** Quem entra primeiro vira admin. Com a entrada fechada, ninguém novo entra. */
  private async addMember(
    family: { id: string; name: string; openJoin: number },
    name: string,
  ): Promise<JoinResult> {
    if (family.openJoin !== 1) return { ok: false, reason: "closed" };

    const memberId = crypto.randomUUID();
    const sessionToken = generateToken();
    const now = new Date().toISOString();

    // O papel é decidido dentro do próprio INSERT, então dois aparelhos
    // entrando juntos nunca viram admin ao mesmo tempo.
    await this.db
      .prepare(
        `INSERT INTO members (id, family_id, name, role, session_hash, joined_at, last_seen_at)
         SELECT ?, ?, ?,
           CASE WHEN EXISTS (SELECT 1 FROM members WHERE family_id = ?) THEN 'member' ELSE 'admin' END,
           ?, ?, ?`,
      )
      .bind(memberId, family.id, name, family.id, await hashToken(sessionToken), now, now)
      .run();

    const member = await this.db
      .prepare("SELECT role FROM members WHERE id = ?")
      .bind(memberId)
      .first<{ role: Role }>();

    return {
      ok: true,
      sessionToken,
      session: {
        memberId,
        name,
        role: member?.role ?? "member",
        familyId: family.id,
        familyName: family.name,
      },
    };
  }

  async findSession(sessionToken: string): Promise<SessionInfo | null> {
    return this.db
      .prepare(
        `SELECT m.id AS memberId, m.name, m.role, f.id AS familyId, f.name AS familyName
         FROM members m JOIN families f ON f.id = m.family_id
         WHERE m.session_hash = ?`,
      )
      .bind(await hashToken(sessionToken))
      .first<SessionInfo>();
  }

  async touch(memberId: string) {
    await this.db
      .prepare("UPDATE members SET last_seen_at = ? WHERE id = ?")
      .bind(new Date().toISOString(), memberId)
      .run();
  }

  async listMembers(familyId: string): Promise<Member[]> {
    const { results } = await this.db
      .prepare(
        `SELECT id, name, role, joined_at AS joinedAt, last_seen_at AS lastSeenAt
         FROM members WHERE family_id = ? ORDER BY joined_at`,
      )
      .bind(familyId)
      .all<Member>();
    return results;
  }

  /** O filtro por família impede remover membro de outra família. */
  async removeMember(familyId: string, memberId: string): Promise<boolean> {
    const { meta } = await this.db
      .prepare("DELETE FROM members WHERE id = ? AND family_id = ?")
      .bind(memberId, familyId)
      .run();
    return meta.changes > 0;
  }

  async settings(familyId: string): Promise<FamilySettings> {
    const row = await this.db
      .prepare("SELECT open_join AS openJoin FROM families WHERE id = ?")
      .bind(familyId)
      .first<{ openJoin: number }>();
    return { openJoin: row?.openJoin === 1 };
  }

  /** Fechar a entrada não tira ninguém: só impede gente nova de entrar. */
  async setOpenJoin(familyId: string, open: boolean) {
    await this.db
      .prepare("UPDATE families SET open_join = ? WHERE id = ?")
      .bind(open ? 1 : 0, familyId)
      .run();
  }
}
