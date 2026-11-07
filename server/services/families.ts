import type { Member, Role, SessionInfo } from "../../shared/contract.ts";
import type { Database } from "../db/database.ts";
import { generateToken, hashToken } from "./tokens.ts";

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

  /** Quem entra primeiro vira admin. Retorna null se o convite não vale. */
  async join(
    inviteToken: string,
    name: string,
  ): Promise<{ session: SessionInfo; sessionToken: string } | null> {
    const family = await this.db
      .prepare("SELECT id, name FROM families WHERE invite_hash = ?")
      .bind(await hashToken(inviteToken))
      .first<{ id: string; name: string }>();
    if (!family) return null;

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

  async isInviteFor(inviteToken: string, familyId: string): Promise<boolean> {
    const row = await this.db
      .prepare("SELECT 1 AS ok FROM families WHERE id = ? AND invite_hash = ?")
      .bind(familyId, await hashToken(inviteToken))
      .first();
    return row !== null;
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

  /** Gera convite novo; o anterior para de funcionar na hora. */
  async rotateInvite(familyId: string): Promise<string> {
    const inviteToken = generateToken();
    await this.db
      .prepare("UPDATE families SET invite_hash = ? WHERE id = ?")
      .bind(await hashToken(inviteToken), familyId)
      .run();
    return inviteToken;
  }
}
