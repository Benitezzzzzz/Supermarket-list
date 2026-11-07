import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import type { Database, SqlValue, Statement } from "./database.ts";

const MIGRATIONS_DIR = join(import.meta.dirname, "migrations");

class SqliteStatement implements Statement {
  private db: DatabaseSync;
  private sql: string;
  private values: SqlValue[];

  constructor(db: DatabaseSync, sql: string, values: SqlValue[] = []) {
    this.db = db;
    this.sql = sql;
    this.values = values;
  }

  bind(...values: SqlValue[]): Statement {
    return new SqliteStatement(this.db, this.sql, values);
  }

  async first<T>(): Promise<T | null> {
    const row = this.db.prepare(this.sql).get(...(this.values as SQLInputValue[]));
    return row ? ({ ...row } as T) : null;
  }

  async all<T>(): Promise<{ results: T[] }> {
    const rows = this.db.prepare(this.sql).all(...(this.values as SQLInputValue[]));
    return { results: rows.map((row) => ({ ...row }) as T) };
  }

  async run(): Promise<{ meta: { changes: number } }> {
    return this.execute();
  }

  execute() {
    const result = this.db.prepare(this.sql).run(...(this.values as SQLInputValue[]));
    return { meta: { changes: Number(result.changes) } };
  }
}

/** Banco em memória com as mesmas migrações do D1, para os testes. */
export function openTestDatabase(): Database {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON");
  for (const file of readdirSync(MIGRATIONS_DIR).sort()) {
    db.exec(readFileSync(join(MIGRATIONS_DIR, file), "utf8"));
  }

  return {
    prepare: (sql) => new SqliteStatement(db, sql),
    async batch(statements) {
      db.exec("BEGIN");
      try {
        const results = statements.map((statement) => (statement as SqliteStatement).execute());
        db.exec("COMMIT");
        return results;
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
    },
  };
}
