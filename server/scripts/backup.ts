import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { config } from "../config.ts";
import { openDatabase } from "../db/database.ts";

mkdirSync(config.backupDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const target = join(config.backupDir, `lista-${stamp}.db`);

// VACUUM INTO gera uma cópia consistente mesmo com o servidor rodando.
const db = openDatabase(config.databasePath);
db.prepare("VACUUM INTO ?").run(target);
db.close();

console.log(`Backup salvo em ${target}`);
