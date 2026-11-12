import type { MeResponse } from "../domain/types";
import { AccessRevokedError } from "./backend";
import { api } from "./http";

import { deriveKey, normalizeUsername } from "../../shared/password.ts";

export { deriveKey, normalizeUsername };

export const MIN_PASSWORD = 6;
export const USERNAME_PATTERN = /^[a-z0-9._-]{3,30}$/;

const ME_KEY = "lista-mercado:conta";
const LIST_KEY = "lista-mercado:lista-atual";

export type MeState = { kind: "user"; me: MeResponse } | { kind: "legacy"; name: string } | { kind: "none" };

function remember(me: MeResponse) {
  try {
    localStorage.setItem(ME_KEY, JSON.stringify(me));
  } catch {
    // Sem armazenamento, o app só não abre offline.
  }
}

function remembered(): MeResponse | null {
  try {
    const raw = localStorage.getItem(ME_KEY);
    return raw ? (JSON.parse(raw) as MeResponse) : null;
  } catch {
    return null;
  }
}

/** Ao sair, apaga do aparelho a conta e as cópias das listas. */
export function forgetEverything() {
  try {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith("lista-mercado:")) localStorage.removeItem(key);
    }
  } catch {
    // Nada a limpar.
  }
}

/** Confere a conta no servidor; sem rede, abre com a última conhecida. */
export async function fetchMe(): Promise<MeState> {
  try {
    const data = (await (await api("/auth/me")).json()) as MeResponse | { legacy: { name: string } };
    if ("legacy" in data) return { kind: "legacy", name: data.legacy.name };
    remember(data);
    return { kind: "user", me: data };
  } catch (error) {
    if (error instanceof AccessRevokedError) {
      forgetEverything();
      return { kind: "none" };
    }
    const cached = remembered();
    return cached ? { kind: "user", me: cached } : { kind: "none" };
  }
}

async function authenticate(path: string, body: Record<string, string>): Promise<MeResponse> {
  const me = (await (await api(path, "POST", body)).json()) as MeResponse;
  remember(me);
  return me;
}

export async function signup(username: string, displayName: string, password: string) {
  const passwordKey = await deriveKey(username, password);
  return authenticate("/auth/signup", { username: normalizeUsername(username), displayName, passwordKey });
}

export async function login(username: string, password: string) {
  const passwordKey = await deriveKey(username, password);
  return authenticate("/auth/login", { username: normalizeUsername(username), passwordKey });
}

/** Aparelho da versão sem contas cria a conta e leva a lista junto. */
export async function claimLegacy(username: string, displayName: string, password: string) {
  const passwordKey = await deriveKey(username, password);
  return authenticate("/auth/claim", { username: normalizeUsername(username), displayName, passwordKey });
}

export async function changePassword(username: string, current: string, next: string) {
  const [currentKey, newKey] = await Promise.all([deriveKey(username, current), deriveKey(username, next)]);
  await api("/auth/password", "PUT", { currentKey, newKey });
}

export async function logout() {
  try {
    await api("/auth/logout", "POST");
  } finally {
    forgetEverything();
  }
}

export function preferredListId(): string | null {
  try {
    return localStorage.getItem(LIST_KEY);
  } catch {
    return null;
  }
}

export function setPreferredListId(id: string) {
  try {
    localStorage.setItem(LIST_KEY, id);
  } catch {
    // Sem armazenamento, abre na primeira lista.
  }
}
