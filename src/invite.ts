import { inviteCodeFromPath } from "./domain/invite";

/**
 * Quem abre /convite/<código> pode ainda precisar entrar ou criar a conta.
 * O código fica guardado no aparelho até a pessoa entrar na lista.
 */

const KEY = "lista:convite";

export function captureInvite(location: Location = window.location): void {
  const code = inviteCodeFromPath(location.pathname);
  if (!code) return;
  try {
    localStorage.setItem(KEY, code);
  } catch {
    // Sem armazenamento, o convite se perde; a pessoa pode abrir o link de novo depois de entrar.
  }
  history.replaceState(null, "", `/${location.search}${location.hash}`);
}

export function pendingInvite(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function clearInvite(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nada a limpar.
  }
}
