import { execFileSync } from "node:child_process";
import { randomInt } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { deriveKey, normalizeUsername } from "../../shared/password.ts";
import { generateToken, hashToken } from "../services/tokens.ts";

/**
 * Redefine a senha de alguém que esqueceu (o app não tem e-mail para isso).
 * Desconecta os aparelhos da pessoa e destrava a conta.
 *
 *   npm run user:reset-password -- pai --remoto
 */

const DATABASE = "lista-do-mercado";
const WRANGLER = fileURLToPath(new URL("../../node_modules/wrangler/bin/wrangler.js", import.meta.url));
// Sem letras que se confundem (l, 1, o, 0), para ditar por telefone.
const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    remoto: { type: "boolean", default: false },
    senha: { type: "string" },
  },
});

const username = normalizeUsername(positionals[0] ?? "");
if (!username) {
  console.error("Uso: npm run user:reset-password -- <usuario> [--remoto] [--senha nova]");
  process.exit(1);
}

const password = values.senha ?? Array.from({ length: 8 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
const salt = generateToken();
const hash = await hashToken(`${salt}:${await deriveKey(username, password)}`);
const quoted = `'${username.replaceAll("'", "''")}'`;

const sql = `UPDATE users SET password_hash = '${hash}', password_salt = '${salt}', failed_attempts = 0, locked_until = NULL WHERE username = ${quoted};
DELETE FROM sessions WHERE user_id = (SELECT id FROM users WHERE username = ${quoted});
SELECT changes() AS alterados, (SELECT count(*) FROM users WHERE username = ${quoted}) AS encontrado;`;

const dir = mkdtempSync(join(tmpdir(), "lista-senha-"));
const file = join(dir, "senha.sql");
writeFileSync(file, sql);
let output: string;
try {
  output = execFileSync(
    process.execPath,
    [WRANGLER, "d1", "execute", DATABASE, values.remoto ? "--remote" : "--local", "--file", file, "--json", "--yes"],
    { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] },
  );
} finally {
  rmSync(dir, { recursive: true, force: true });
}

if (!/"encontrado":\s*1/.test(output)) {
  console.error(`Não existe o usuário "${username}".`);
  process.exit(1);
}
console.log(`Senha de "${username}" redefinida ${values.remoto ? "em produção" : "no banco local"}.`);
console.log(`Nova senha: ${password}`);
console.log("Os aparelhos da pessoa foram desconectados. Ela pode trocar a senha em Sua conta.");
