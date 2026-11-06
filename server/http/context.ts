import type { Context } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import type { z } from "zod";
import type { SessionInfo } from "../../shared/contract.ts";
import type { FamilyService } from "../services/families.ts";

export const SESSION_COOKIE = "lista_sessao";
const ONE_YEAR = 60 * 60 * 24 * 365;

export type Env = { Variables: { session: SessionInfo } };

export function setSessionCookie(c: Context, sessionToken: string) {
  // Atrás de um proxy HTTPS o Node recebe HTTP, por isso o cabeçalho encaminhado conta.
  const https =
    c.req.header("x-forwarded-proto") === "https" || new URL(c.req.url).protocol === "https:";
  setCookie(c, SESSION_COOKIE, sessionToken, {
    httpOnly: true,
    secure: https,
    sameSite: "Strict",
    path: "/",
    maxAge: ONE_YEAR,
  });
}

/** Coloca a sessão no contexto, ou responde 401. */
export function requireSession(families: FamilyService) {
  return createMiddleware<Env>(async (c, next) => {
    const token = getCookie(c, SESSION_COOKIE);
    const session = token ? families.findSession(token) : null;
    if (!session) throw new HTTPException(401, { message: "Sessão inválida" });
    c.set("session", session);
    await next();
  });
}

export const requireAdmin = createMiddleware<Env>(async (c, next) => {
  if (c.get("session").role !== "admin") {
    throw new HTTPException(403, { message: "Só o administrador pode fazer isso" });
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
