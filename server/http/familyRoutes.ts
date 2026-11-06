import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import type { FamilyService } from "../services/families.ts";
import { type Env, requireAdmin, requireSession } from "./context.ts";
import type { EventHub } from "./eventHub.ts";

export function familyRoutes(families: FamilyService, hub: EventHub) {
  const routes = new Hono<Env>();
  routes.use("*", requireSession(families));

  routes.get("/members", (c) => c.json(families.listMembers(c.get("session").familyId)));

  routes.delete("/members/:id", requireAdmin, (c) => {
    const { familyId, memberId } = c.get("session");
    const target = c.req.param("id");
    if (target === memberId) {
      throw new HTTPException(400, { message: "O administrador não pode remover a si mesmo" });
    }
    if (!families.removeMember(familyId, target)) {
      throw new HTTPException(404, { message: "Membro não encontrado" });
    }
    hub.disconnectMember(familyId, target);
    return c.body(null, 204);
  });

  routes.post("/invite", requireAdmin, (c) => {
    const inviteToken = families.rotateInvite(c.get("session").familyId);
    return c.json({ inviteToken });
  });

  return routes;
}
