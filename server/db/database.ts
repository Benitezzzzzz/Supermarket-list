/**
 * O subconjunto da API do Cloudflare D1 que o servidor usa. Em produção é o
 * próprio D1; nos testes, um adaptador sobre o SQLite do Node (sqliteAdapter.ts).
 */

export type SqlValue = string | number | null;

export interface Statement {
  bind(...values: SqlValue[]): Statement;
  first<T>(): Promise<T | null>;
  all<T>(): Promise<{ results: T[] }>;
  run(): Promise<{ meta: { changes: number } }>;
}

export interface Database {
  prepare(sql: string): Statement;
  /** Executa tudo numa transação: ou todas as instruções valem, ou nenhuma. */
  batch(statements: Statement[]): Promise<unknown[]>;
}

/** A lista da família, resolvida no próprio banco a partir da sessão. */
export const FAMILY_LIST =
  "(SELECT id FROM lists WHERE family_id = ? ORDER BY created_at LIMIT 1)";
