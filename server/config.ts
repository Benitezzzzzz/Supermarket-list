import { join, resolve } from "node:path";

const dataDir = resolve(process.env.DATA_DIR ?? "data");

export const config = {
  port: Number(process.env.PORT ?? 3000),
  host: process.env.HOST ?? "0.0.0.0",
  databasePath: join(dataDir, "lista.db"),
  backupDir: join(dataDir, "backups"),
  /** Endereço público do app, usado para montar os links de convite no terminal. */
  appUrl: (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, ""),
};
