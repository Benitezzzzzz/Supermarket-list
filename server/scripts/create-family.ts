import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { z } from "zod";
import { itemSchema } from "../../shared/contract.ts";
import { generateToken, hashToken } from "../services/tokens.ts";

/**
 * Cria uma família direto no D1, local ou de produção (--remoto).
 * Não existe cadastro pela API: famílias só nascem por aqui.
 */

const DATABASE = "lista-do-mercado";
// Chama o Wrangler direto pelo Node: sem shell intermediário, nenhum processo fica órfão.
const WRANGLER = fileURLToPath(new URL("../../node_modules/wrangler/bin/wrangler.js", import.meta.url));

const seedSchema = z.object({
  items: z.array(itemSchema),
  customCategories: z.array(z.string().trim().min(1).max(40)),
});

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    importar: { type: "string" },
    remoto: { type: "boolean", default: false },
    url: { type: "string", default: "http://localhost:8787" },
  },
});

const name = positionals[0]?.trim();
if (!name) {
  console.error(
    'Uso: npm run family:create -- "Nome da família" [--importar arquivo.json] [--remoto --url https://...]',
  );
  process.exit(1);
}

const seed = values.importar
  ? seedSchema.parse(JSON.parse(readFileSync(values.importar, "utf8")))
  : { items: [], customCategories: [] };

const quote = (value: string | number) =>
  typeof value === "number" ? String(value) : `'${value.replaceAll("'", "''")}'`;

const familyId = crypto.randomUUID();
const listId = crypto.randomUUID();
const inviteToken = generateToken();
const now = new Date().toISOString();

const sql = [
  `INSERT INTO families (id, name, invite_hash, created_at) VALUES (${[familyId, name, await hashToken(inviteToken), now].map(quote).join(", ")});`,
  `INSERT INTO lists (id, family_id, name, created_at) VALUES (${[listId, familyId, "Lista do Mercado", now].map(quote).join(", ")});`,
  ...seed.items.map(
    (item) =>
      `INSERT INTO items (list_id, id, text, quantity, done, category, created_at) VALUES (${[
        listId,
        item.id,
        item.text,
        item.quantity,
        item.done ? 1 : 0,
        item.category,
        item.createdAt,
      ]
        .map(quote)
        .join(", ")});`,
  ),
  ...seed.customCategories.map(
    (category) =>
      `INSERT INTO categories (list_id, name, created_at) VALUES (${[listId, category, now].map(quote).join(", ")});`,
  ),
].join("\n");

const dir = mkdtempSync(join(tmpdir(), "lista-familia-"));
const file = join(dir, "familia.sql");
writeFileSync(file, sql);
try {
  // O arquivo SQL é executado de uma vez; se algo falhar, nada fica pela metade.
  execFileSync(
    process.execPath,
    [WRANGLER, "d1", "execute", DATABASE, values.remoto ? "--remote" : "--local", "--file", file, "--yes"],
    { stdio: ["ignore", "ignore", "inherit"] },
  );
} finally {
  rmSync(dir, { recursive: true, force: true });
}

if (seed.items.length > 0) console.log(`${seed.items.length} itens importados.`);
console.log(`Família "${name}" criada ${values.remoto ? "em produção" : "no banco local"}.`);
console.log("Abra o endereço abaixo e digite seu nome. Quem entra primeiro vira administrador.");
console.log(values.url.replace(/\/$/, ""));
// Só é necessário se o mesmo app tiver mais de uma família.
console.log(`Convite, para quando houver mais de uma família: #convite=${inviteToken}`);
