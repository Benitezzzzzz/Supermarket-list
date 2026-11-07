/**
 * Derivação da senha, usada pelo app e pelo comando de redefinir senha.
 * A senha nunca sai do aparelho: vira uma chave com PBKDF2 (600 mil iterações,
 * o recomendado pela OWASP), e só a chave vai ao servidor, que ainda aplica o
 * próprio sal.
 */
export const PBKDF2_ITERATIONS = 600_000;

export function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function deriveKey(username: string, password: string, iterations = PBKDF2_ITERATIONS) {
  const encoder = new TextEncoder();
  const base = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: encoder.encode(`lista-do-mercado:${normalizeUsername(username)}`),
      iterations,
    },
    base,
    256,
  );
  return toHex(bits);
}
