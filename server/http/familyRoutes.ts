import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import type { FamilyService } from "../services/families.ts";
import { type Env, requireAdmin, requireSession } from "./context.ts";
import type { Notifier } from "./notifier.ts";

export function familyRoutes(families: FamilyService, notifier: Notifier) {
  const routes = new Hono<Env>();
  routes.use("*", requireSession(families));

  routes.get("/members", async (c) => c.json(await families.listMembers(c.get("session").familyId)));

  routes.delete("/members/:id", requireAdmin, async (c) => {
    const { familyId, memberId } = c.get("session");
    const target = c.req.param("id");
    if (target === memberId) {
      throw new HTTPException(400, { message: "O administrador não pode remover a si mesmo" });
    }
    if (!(await families.removeMember(familyId, target))) {
      throw new HTTPException(404, { message: "Membro não encontrado" });
    }
    await notifier.disconnectMember(familyId, target);
    return c.body(null, 204);
  });

  routes.post("/invite", requireAdmin, async (c) => {
    const inviteToken = await families.rotateInvite(c.get("session").familyId);
    return c.json({ inviteToken });
  });

  return routes;
}
