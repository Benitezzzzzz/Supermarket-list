import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import { HTTPException } from "hono/http-exception";
import { changePasswordSchema, loginSchema, signupSchema } from "../../shared/contract.ts";
import type { AccountService, AuthResult } from "../services/accounts.ts";
import type { MembershipService } from "../services/memberships.ts";
import {
  clearCookies,
  type Env,
  LEGACY_COOKIE,
  readJson,
  requireUser,
  SESSION_COOKIE,
  setSessionCookie,
} from "./context.ts";

const MESSAGES = {
  taken: "Esse usuário já existe. Escolha outro.",
  invalid: "Usuário ou senha incorretos.",
  locked: "Muitas tentativas erradas. Espere 15 minutos e tente de novo.",
} as const;

function fail(result: Extract<AuthResult, { ok: false }>): never {
  const status = result.reason === "taken" ? 409 : result.reason === "locked" ? 429 : 401;
  throw new HTTPException(status, { message: MESSAGES[result.reason] });
}

export function authRoutes(accounts: AccountService, memberships: MembershipService) {
  const routes = new Hono<Env>();

  routes.post("/signup", async (c) => {
    const { username, displayName, passwordKey } = await readJson(c, signupSchema);
    const result = await accounts.signup(username, displayName, passwordKey);
    if (!result.ok) fail(result);
    setSessionCookie(c, result.sessionToken);
    return c.json({ user: result.user, lists: [] }, 201);
  });

  routes.post("/login", async (c) => {
    const { username, passwordKey } = await readJson(c, loginSchema);
    const result = await accounts.login(username, passwordKey);
    if (!result.ok) fail(result);
    setSessionCookie(c, result.sessionToken);
    return c.json({ user: result.user, lists: await memberships.listsOf(result.user.id) });
  });

  routes.post("/logout", async (c) => {
    const token = getCookie(c, SESSION_COOKIE);
    if (token) await accounts.logout(token);
    clearCookies(c);
    return c.body(null, 204);
  });

  /** Quem está logado, ou o nome do aparelho antigo que ainda precisa criar a conta. */
  routes.get("/me", async (c) => {
    const token = getCookie(c, SESSION_COOKIE);
    const user = token ? await accounts.findUser(token) : null;
    if (token && user) {
      await accounts.touch(token);
      setSessionCookie(c, token); // renova a validade: quem usa o app nunca é desconectado
      return c.json({ user, lists: await memberships.listsOf(user.id) });
    }
    const legacyToken = getCookie(c, LEGACY_COOKIE);
    const legacy = legacyToken ? await accounts.findLegacyMember(legacyToken) : null;
    if (legacy) return c.json({ legacy: { name: legacy.name } });
    throw new HTTPException(401, { message: "Entre na sua conta" });
  });

  /** Aparelho da versão anterior cria a conta e leva junto o acesso à lista. */
  routes.post("/claim", async (c) => {
    const { username, displayName, passwordKey } = await readJson(c, signupSchema);
    const legacyToken = getCookie(c, LEGACY_COOKIE);
    const legacy = legacyToken ? await accounts.findLegacyMember(legacyToken) : null;
    if (!legacy) throw new HTTPException(404, { message: "Este aparelho não tem acesso antigo para transferir" });

    const result = await accounts.claimLegacy(legacy, username, displayName, passwordKey);
    if (!result.ok) fail(result);
    clearCookies(c);
    setSessionCookie(c, result.sessionToken);
    return c.json({ user: result.user, lists: await memberships.listsOf(result.user.id) }, 201);
  });

  routes.put("/password", requireUser(accounts), async (c) => {
    const { currentKey, newKey } = await readJson(c, changePasswordSchema);
    const changed = await accounts.changePassword(c.get("user").id, c.get("sessionToken"), currentKey, newKey);
    if (!changed) throw new HTTPException(403, { message: "A senha atual não confere." });
    return c.body(null, 204);
  });

  return routes;
}
