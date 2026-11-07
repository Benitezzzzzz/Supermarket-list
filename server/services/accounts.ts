import type { Role, UserInfo } from "../../shared/contract.ts";
import type { Database } from "../db/database.ts";
import { generateToken, hashToken } from "./tokens.ts";

const MAX_FAILURES = 5;
const LOCK_MS = 15 * 60 * 1000;

export type AuthResult =
  | { ok: true; user: UserInfo; sessionToken: string }
  | { ok: false; reason: "taken" | "invalid" | "locked" };

interface CredentialRow extends UserInfo {
  passwordHash: string;
  passwordSalt: string;
  failedAttempts: number;
  lockedUntil: string | null;
}

export interface LegacyMember {
  memberId: string;
  name: string;
  role: Role;
  familyId: string;
}

/**
 * O aparelho já manda a senha derivada com PBKDF2 (caro); aqui basta um
 * SHA-256 com sal próprio, que cabe no limite de CPU do plano gratuito.
 */
function hashPassword(salt: string, passwordKey: string): Promise<string> {
  return hashToken(`${salt}:${passwordKey}`);
}

export class AccountService {
  private db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  async signup(username: string, displayName: string, passwordKey: string): Promise<AuthResult> {
    const taken = await this.db.prepare("SELECT 1 AS x FROM users WHERE username = ?").bind(username).first();
    if (taken) return { ok: false, reason: "taken" };

    const id = crypto.randomUUID();
    const salt = generateToken();
    try {
      await this.db
        .prepare(
          `INSERT INTO users (id, username, display_name, password_hash, password_salt, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .bind(id, username, displayName, await hashPassword(salt, passwordKey), salt, new Date().toISOString())
        .run();
    } catch (error) {
      // Duas pessoas criando o mesmo usuário ao mesmo tempo.
      if (/UNIQUE/i.test(String(error))) return { ok: false, reason: "taken" };
      throw error;
    }
    return { ok: true, user: { id, username, displayName }, sessionToken: await this.createSession(id) };
  }

  /** Erra 5 vezes e a conta fica bloqueada por 15 minutos. A mensagem não diz se o usuário existe. */
  async login(username: string, passwordKey: string): Promise<AuthResult> {
    const row = await this.db
      .prepare(
        `SELECT id, username, display_name AS displayName, password_hash AS passwordHash,
           password_salt AS passwordSalt, failed_attempts AS failedAttempts, locked_until AS lockedUntil
         FROM users WHERE username = ?`,
      )
      .bind(username)
      .first<CredentialRow>();
    if (!row) return { ok: false, reason: "invalid" };

    const now = new Date();
    if (row.lockedUntil && row.lockedUntil > now.toISOString()) return { ok: false, reason: "locked" };

    if ((await hashPassword(row.passwordSalt, passwordKey)) !== row.passwordHash) {
      const failures = row.failedAttempts + 1;
      if (failures >= MAX_FAILURES) {
        await this.db
          .prepare("UPDATE users SET failed_attempts = 0, locked_until = ? WHERE id = ?")
          .bind(new Date(now.getTime() + LOCK_MS).toISOString(), row.id)
          .run();
        return { ok: false, reason: "locked" };
      }
      await this.db.prepare("UPDATE users SET failed_attempts = ? WHERE id = ?").bind(failures, row.id).run();
      return { ok: false, reason: "invalid" };
    }

    await this.db
      .prepare("UPDATE users SET failed_attempts = 0, locked_until = NULL WHERE id = ?")
      .bind(row.id)
      .run();
    const user = { id: row.id, username: row.username, displayName: row.displayName };
    return { ok: true, user, sessionToken: await this.createSession(row.id) };
  }

  private async createSession(userId: string): Promise<string> {
    const token = generateToken();
    const now = new Date().toISOString();
    await this.db
      .prepare("INSERT INTO sessions (token_hash, user_id, created_at, last_seen_at) VALUES (?, ?, ?, ?)")
      .bind(await hashToken(token), userId, now, now)
      .run();
    return token;
  }

  async findUser(sessionToken: string): Promise<UserInfo | null> {
    return this.db
      .prepare(
        `SELECT u.id, u.username, u.display_name AS displayName
         FROM sessions s JOIN users u ON u.id = s.user_id
         WHERE s.token_hash = ?`,
      )
      .bind(await hashToken(sessionToken))
      .first<UserInfo>();
  }

  async touch(sessionToken: string) {
    await this.db
      .prepare("UPDATE sessions SET last_seen_at = ? WHERE token_hash = ?")
      .bind(new Date().toISOString(), await hashToken(sessionToken))
      .run();
  }

  async logout(sessionToken: string) {
    await this.db.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(await hashToken(sessionToken)).run();
  }

  /** Troca a senha e desconecta os outros aparelhos; este continua logado. */
  async changePassword(userId: string, currentToken: string, currentKey: string, newKey: string) {
    const row = await this.db
      .prepare("SELECT password_hash AS passwordHash, password_salt AS passwordSalt FROM users WHERE id = ?")
      .bind(userId)
      .first<{ passwordHash: string; passwordSalt: string }>();
    if (!row || (await hashPassword(row.passwordSalt, currentKey)) !== row.passwordHash) return false;

    const salt = generateToken();
    await this.db.batch([
      this.db
        .prepare("UPDATE users SET password_hash = ?, password_salt = ? WHERE id = ?")
        .bind(await hashPassword(salt, newKey), salt, userId),
      this.db
        .prepare("DELETE FROM sessions WHERE user_id = ? AND token_hash != ?")
        .bind(userId, await hashToken(currentToken)),
    ]);
    return true;
  }

  /** Aparelho da versão anterior (sem conta), identificado pelo cookie antigo. */
  async findLegacyMember(legacyToken: string): Promise<LegacyMember | null> {
    return this.db
      .prepare(
        `SELECT id AS memberId, name, role, family_id AS familyId
         FROM members WHERE session_hash = ?`,
      )
      .bind(await hashToken(legacyToken))
      .first<LegacyMember>();
  }

  /**
   * Transforma o aparelho antigo em conta: cria o usuário e o coloca na lista
   * da família com o mesmo papel. O registro antigo deixa de valer.
   */
  async claimLegacy(
    legacy: LegacyMember,
    username: string,
    displayName: string,
    passwordKey: string,
  ): Promise<AuthResult> {
    const result = await this.signup(username, displayName, passwordKey);
    if (!result.ok) return result;
    await this.db.batch([
      this.db
        .prepare(
          `INSERT INTO list_members (list_id, user_id, role, joined_at)
           SELECT id, ?, ?, ? FROM lists WHERE family_id = ?
           ON CONFLICT DO NOTHING`,
        )
        .bind(result.user.id, legacy.role, new Date().toISOString(), legacy.familyId),
      this.db.prepare("DELETE FROM members WHERE id = ?").bind(legacy.memberId),
    ]);
    return result;
  }
}
