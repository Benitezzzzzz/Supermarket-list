function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** 256 bits aleatórios: inviável de adivinhar, então dispensa limite de tentativas. */
export function generateToken(): string {
  return toHex(crypto.getRandomValues(new Uint8Array(32)));
}

/** Tokens já têm alta entropia, então SHA-256 basta (não é senha de usuário). */
export async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return toHex(new Uint8Array(digest));
}
