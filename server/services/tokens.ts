import { createHash, randomBytes } from "node:crypto";

/** 256 bits aleatórios: inviável de adivinhar, então dispensa limite de tentativas. */
export function generateToken(): string {
  return randomBytes(32).toString("hex");
}

/** Tokens já têm alta entropia, então SHA-256 basta (não é senha de usuário). */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
