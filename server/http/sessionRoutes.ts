import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import { HTTPException } from "hono/http-exception";
import { joinSchema } from "../../shared/contract.ts";
import type { FamilyService } from "../services/families.ts";
import {
  type Env,
  readJson,
  requireSession,
  SESSION_COOKIE,
  setSessionCookie,
} from "./context.ts";

export function sessionRoutes(families: FamilyService) {
  const routes = new Hono<Env>();

  routes.post("/", async (c) => {
    const { inviteToken, name } = await readJson(c, joinSchema);

    // Aparelho já conectado que abre o link de novo não vira um membro duplicado.
    const cookie = getCookie(c, SESSION_COOKIE);
    const current = cookie ? families.findSession(cookie) : null;
    if (current && families.isInviteFor(inviteToken, current.familyId)) {
      return c.json(current);
    }

    const joined = families.join(inviteToken, name);
    if (!joined) throw new HTTPException(404, { message: "Convite inválido" });
    setSessionCookie(c, joined.sessionToken);
    return c.json(joined.session, 201);
  });

  routes.get("/", requireSession(families), (c) => {
    const session = c.get("session");
    families.touch(session.memberId);
    // Renova a validade do cookie: quem usa o app nunca é desconectado.
    setSessionCookie(c, getCookie(c, SESSION_COOKIE)!);
    return c.json(session);
  });

  return routes;
}
