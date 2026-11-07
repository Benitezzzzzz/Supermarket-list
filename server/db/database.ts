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
