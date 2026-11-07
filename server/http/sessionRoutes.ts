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

    // Aparelho que já está na lista não vira um membro duplicado.
    const cookie = getCookie(c, SESSION_COOKIE);
    const current = cookie ? await families.findSession(cookie) : null;
    if (current) return c.json(current);

    const joined = inviteToken
      ? await families.join(inviteToken, name)
      : await families.joinOpen(name);
    if (!joined.ok && joined.reason === "closed") {
      throw new HTTPException(403, {
        message: "A entrada de pessoas novas está fechada. Peça para quem cuida da lista abrir, na tela Família.",
      });
    }
    if (!joined.ok) throw new HTTPException(404, { message: "Lista não encontrada" });
    setSessionCookie(c, joined.sessionToken);
    return c.json(joined.session, 201);
  });

  routes.get("/", requireSession(families), async (c) => {
    const session = c.get("session");
    await families.touch(session.memberId);
    // Renova a validade do cookie: quem usa o app nunca é desconectado.
    const token = getCookie(c, SESSION_COOKIE);
    if (token) setSessionCookie(c, token);
    return c.json(session);
  });

  return routes;
}
