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

/** O endereço único da lista, que serve para qualquer pessoa da família entrar. */
export function appLink(): string {
  return `${location.origin}${location.pathname}`;
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

/** Entra só com o nome. Um convite antigo no endereço ainda é aceito, se houver. */
export async function joinFamily(name: string, inviteToken?: string | null): Promise<SessionInfo> {
  const body = inviteToken ? { name, inviteToken } : { name };
  const session = (await (await api("/session", "POST", body)).json()) as SessionInfo;
  remember(session);
  clearInviteFromUrl();
  return session;
}
