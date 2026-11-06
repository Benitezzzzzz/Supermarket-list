import { mkdirSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";

const MIGRATIONS_DIR = join(import.meta.dirname, "migrations");

export type Database = DatabaseSync;

/** Roda em transação tudo que precisa acontecer junto. */
export function transaction<T>(db: Database, work: () => T): T {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = work();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

/** Aplica as migrações ainda não rodadas; a versão fica em PRAGMA user_version. */
function migrate(db: Database) {
  const { user_version: current } = db.prepare("PRAGMA user_version").get() as {
    user_version: number;
  };
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith(".sql"))
    .sort();

  files.forEach((file, index) => {
    const version = index + 1;
    if (version <= current) return;
    transaction(db, () => {
      db.exec(readFileSync(join(MIGRATIONS_DIR, file), "utf8"));
      db.exec(`PRAGMA user_version = ${version}`);
    });
  });
}

export function openDatabase(path: string): Database {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA foreign_keys = ON");
  db.exec("PRAGMA busy_timeout = 5000");
  migrate(db);
  return db;
}
