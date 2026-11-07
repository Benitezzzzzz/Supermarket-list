import type { Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import type { z } from "zod";
import type { Role, UserInfo } from "../../shared/contract.ts";
import type { AccountService } from "../services/accounts.ts";
import type { MembershipService } from "../services/memberships.ts";

export const SESSION_COOKIE = "lista_conta";
/** Cookie dos aparelhos da versão anterior, sem conta. Só serve para transferir o acesso. */
export const LEGACY_COOKIE = "lista_sessao";
const ONE_YEAR = 60 * 60 * 24 * 365;

export type Env = {
  Variables: { user: UserInfo; sessionToken: string; listId: string; role: Role };
};

function isHttps(c: Context) {
  // Atrás de um proxy HTTPS a aplicação pode receber HTTP, por isso o cabeçalho encaminhado conta.
  return c.req.header("x-forwarded-proto") === "https" || new URL(c.req.url).protocol === "https:";
}

export function setSessionCookie(c: Context, sessionToken: string) {
  setCookie(c, SESSION_COOKIE, sessionToken, {
    httpOnly: true,
    secure: isHttps(c),
    sameSite: "Strict",
    path: "/",
    maxAge: ONE_YEAR,
  });
}

export function clearCookies(c: Context) {
  deleteCookie(c, SESSION_COOKIE, { path: "/", secure: isHttps(c) });
  deleteCookie(c, LEGACY_COOKIE, { path: "/", secure: isHttps(c) });
}

/** Coloca o usuário no contexto, ou responde 401. */
export function requireUser(accounts: AccountService) {
  return createMiddleware<Env>(async (c, next) => {
    const token = getCookie(c, SESSION_COOKIE);
    const user = token ? await accounts.findUser(token) : null;
    if (!token || !user) throw new HTTPException(401, { message: "Entre na sua conta" });
    c.set("user", user);
    c.set("sessionToken", token);
    await next();
  });
}

/**
 * Só deixa passar quem participa da lista do endereço. Para quem não participa,
 * a lista "não existe": não dá nem para saber se o id é válido.
 */
export function requireListAccess(memberships: MembershipService) {
  return createMiddleware<Env>(async (c, next) => {
    const listId = c.req.param("listId") ?? "";
    const role = await memberships.role(listId, c.get("user").id);
    if (!role) return c.json({ error: "Lista não encontrada", code: "list_access" }, 404);
    c.set("listId", listId);
    c.set("role", role);
    await next();
  });
}

export const requireListAdmin = createMiddleware<Env>(async (c, next) => {
  if (c.get("role") !== "admin") {
    throw new HTTPException(403, { message: "Só quem administra a lista pode fazer isso" });
  }
  await next();
});

/** Exigir JSON impede que formulários de outros sites disparem escritas. */
export async function readJson<T extends z.ZodType>(c: Context, schema: T): Promise<z.infer<T>> {
  if (!c.req.header("content-type")?.startsWith("application/json")) {
    throw new HTTPException(415, { message: "Envie JSON" });
  }
  const body = await c.req.json().catch(() => {
    throw new HTTPException(400, { message: "JSON inválido" });
  });
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw new HTTPException(422, { message: "Dados inválidos" });
  return parsed.data;
}
