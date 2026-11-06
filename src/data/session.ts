import type { SessionInfo } from "../domain/types";
import { AccessRevokedError } from "./backend";
import { api } from "./http";

const SESSION_KEY = "lista-mercado:sessao";

function remember(session: SessionInfo) {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    // Sem armazenamento, o app só não abre offline.
  }
}

function remembered(): SessionInfo | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as SessionInfo) : null;
  } catch {
    return null;
  }
}

function forget() {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    // Nada a limpar.
  }
}

/** Aceita o link completo ou só o código do convite. */
export function extractInvite(input: string): string | null {
  const match = input.match(/[0-9a-f]{64}/i);
  return match ? match[0].toLowerCase() : null;
}

export function inviteLink(token: string): string {
  return `${location.origin}${location.pathname}#convite=${token}`;
}

function clearInviteFromUrl() {
  if (location.hash) history.replaceState(null, "", location.pathname + location.search);
}

/** Confirma a sessão no servidor; sem rede, abre com a última sessão conhecida. */
export async function resumeSession(): Promise<SessionInfo | null> {
  try {
    const session = (await (await api("/session")).json()) as SessionInfo;
    remember(session);
    clearInviteFromUrl();
    return session;
  } catch (error) {
    if (error instanceof AccessRevokedError) {
      forget();
      return null;
    }
    return remembered();
  }
}

export async function joinFamily(inviteToken: string, name: string): Promise<SessionInfo> {
  const session = (await (await api("/session", "POST", { inviteToken, name })).json()) as SessionInfo;
  remember(session);
  clearInviteFromUrl();
  return session;
}
