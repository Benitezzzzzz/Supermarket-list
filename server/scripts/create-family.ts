import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { z } from "zod";
import { itemSchema } from "../../shared/contract.ts";
import { config } from "../config.ts";
import { openDatabase } from "../db/database.ts";
import { FamilyService } from "../services/families.ts";
import { ListService } from "../services/lists.ts";

const seedSchema = z.object({
  items: z.array(itemSchema),
  customCategories: z.array(z.string()),
});

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: { importar: { type: "string" } },
});

const name = positionals[0]?.trim();
if (!name) {
  console.error('Uso: npm run family:create -- "Nome da família" [--importar arquivo.json]');
  process.exit(1);
}

const seed = values.importar
  ? seedSchema.parse(JSON.parse(readFileSync(values.importar, "utf8")))
  : null;

const db = openDatabase(config.databasePath);
const family = new FamilyService(db).create(name);

if (seed) {
  const lists = new ListService(db);
  lists.upsertItems(family.familyId, seed.items);
  for (const category of seed.customCategories) lists.addCategory(family.familyId, category);
  console.log(`${seed.items.length} itens importados.`);
}
db.close();

console.log(`Família "${name}" criada.`);
console.log("Quem abrir este link primeiro vira administrador:");
console.log(`${config.appUrl}/#convite=${family.inviteToken}`);
