import { deriveKey } from "../../shared/password.ts";
import type { AdminOverview } from "../../shared/contract.ts";
import { api } from "./http";

// Sem letras que se confundem (l, 1, o, 0), para ditar por telefone.
const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

function temporaryPassword(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, (byte) => ALPHABET[byte % ALPHABET.length]).join("");
}

export async function fetchOverview(): Promise<AdminOverview> {
  return (await api("/admin/overview")).json() as Promise<AdminOverview>;
}

/**
 * Gera a senha nova aqui no aparelho e manda só a chave derivada. Devolve a
 * senha para o administrador passar à pessoa; ela não fica guardada em lugar nenhum.
 */
export async function resetPassword(user: { id: string; username: string }): Promise<string> {
  const password = temporaryPassword();
  await api(`/admin/users/${encodeURIComponent(user.id)}/password`, "PUT", {
    passwordKey: await deriveKey(user.username, password),
  });
  return password;
}

export async function logoutUser(userId: string): Promise<void> {
  await api(`/admin/users/${encodeURIComponent(userId)}/logout`, "POST");
}
