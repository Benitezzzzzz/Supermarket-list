import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { normalizeUsername } from "../../shared/password.ts";

/**
 * Dá (ou tira, com --remover) o papel de administrador geral. Só por aqui:
 * a API não tem como promover ninguém, nem a pedido do próprio administrador.
 *
 *   npm run user:set-superadmin -- renan --remoto
 */

const DATABASE = "lista-do-mercado";
const WRANGLER = fileURLToPath(new URL("../../node_modules/wrangler/bin/wrangler.js", import.meta.url));

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    remoto: { type: "boolean", default: false },
    remover: { type: "boolean", default: false },
  },
});

const username = normalizeUsername(positionals[0] ?? "");
if (!/^[a-z0-9._-]{3,30}$/.test(username)) {
  console.error("Uso: npm run user:set-superadmin -- <usuario> [--remoto] [--remover]");
  process.exit(1);
}

const flag = values.remover ? 0 : 1;
const sql = `UPDATE users SET is_superadmin = ${flag} WHERE username = '${username}'; SELECT count(*) AS encontrado FROM users WHERE username = '${username}';`;
const output = execFileSync(
  process.execPath,
  [WRANGLER, "d1", "execute", DATABASE, values.remoto ? "--remote" : "--local", "--command", sql, "--json"],
  { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] },
);

if (!/"encontrado":\s*1/.test(output)) {
  console.error(`Não existe o usuário "${username}".`);
  process.exit(1);
}
console.log(
  values.remover
    ? `"${username}" deixou de ser administrador geral ${values.remoto ? "em produção" : "no banco local"}.`
    : `"${username}" agora é administrador geral ${values.remoto ? "em produção" : "no banco local"}.`,
);
