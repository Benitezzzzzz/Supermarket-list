import { randomUUID } from "node:crypto";
import type { Member, Role, SessionInfo } from "../../shared/contract.ts";
import { type Database, transaction } from "../db/database.ts";
import { generateToken, hashToken } from "./tokens.ts";

interface SessionRow {
  memberId: string;
  name: string;
  role: Role;
  familyId: string;
  familyName: string;
}

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

  /** Só o comando de terminal cria famílias: não existe cadastro público. */
  create(name: string): NewFamily {
    const familyId = randomUUID();
    const listId = randomUUID();
    const inviteToken = generateToken();
    const now = new Date().toISOString();

    transaction(this.db, () => {
      this.db
        .prepare("INSERT INTO families (id, name, invite_hash, created_at) VALUES (?, ?, ?, ?)")
        .run(familyId, name, hashToken(inviteToken), now);
      this.db
        .prepare("INSERT INTO lists (id, family_id, name, created_at) VALUES (?, ?, ?, ?)")
        .run(listId, familyId, "Lista do Mercado", now);
    });
    return { familyId, listId, inviteToken };
  }

  /** Quem entra primeiro vira admin. Retorna null se o convite não vale. */
  join(inviteToken: string, name: string): { session: SessionInfo; sessionToken: string } | null {
    const family = this.db
      .prepare("SELECT id, name FROM families WHERE invite_hash = ?")
      .get(hashToken(inviteToken)) as { id: string; name: string } | undefined;
    if (!family) return null;

    const memberId = randomUUID();
    const sessionToken = generateToken();
    const now = new Date().toISOString();

    const role = transaction(this.db, () => {
      const { total } = this.db
        .prepare("SELECT count(*) AS total FROM members WHERE family_id = ?")
        .get(family.id) as { total: number };
      const newRole: Role = total === 0 ? "admin" : "member";
      this.db
        .prepare(
          `INSERT INTO members (id, family_id, name, role, session_hash, joined_at, last_seen_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(memberId, family.id, name, newRole, hashToken(sessionToken), now, now);
      return newRole;
    });

    return {
      sessionToken,
      session: { memberId, name, role, familyId: family.id, familyName: family.name },
    };
  }

  findSession(sessionToken: string): SessionInfo | null {
    const row = this.db
      .prepare(
        `SELECT m.id AS memberId, m.name, m.role, f.id AS familyId, f.name AS familyName
         FROM members m JOIN families f ON f.id = m.family_id
         WHERE m.session_hash = ?`,
      )
      .get(hashToken(sessionToken)) as SessionRow | undefined;
    return row ? { ...row } : null;
  }

  isInviteFor(inviteToken: string, familyId: string): boolean {
    return !!this.db
      .prepare("SELECT 1 FROM families WHERE id = ? AND invite_hash = ?")
      .get(familyId, hashToken(inviteToken));
  }

  touch(memberId: string) {
    this.db
      .prepare("UPDATE members SET last_seen_at = ? WHERE id = ?")
      .run(new Date().toISOString(), memberId);
  }

  listMembers(familyId: string): Member[] {
    const rows = this.db
      .prepare(
        `SELECT id, name, role, joined_at AS joinedAt, last_seen_at AS lastSeenAt
         FROM members WHERE family_id = ? ORDER BY joined_at`,
      )
      .all(familyId) as unknown as Member[];
    return rows.map((row) => ({ ...row }));
  }

  /** O filtro por família impede remover membro de outra família. */
  removeMember(familyId: string, memberId: string): boolean {
    const result = this.db
      .prepare("DELETE FROM members WHERE id = ? AND family_id = ?")
      .run(memberId, familyId);
    return result.changes > 0;
  }

  /** Gera convite novo; o anterior para de funcionar na hora. */
  rotateInvite(familyId: string): string {
    const inviteToken = generateToken();
    this.db
      .prepare("UPDATE families SET invite_hash = ? WHERE id = ?")
      .run(hashToken(inviteToken), familyId);
    return inviteToken;
  }
}
