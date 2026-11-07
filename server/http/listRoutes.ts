import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import {
  addCategorySchema,
  deleteItemsSchema,
  finishSchema,
  paymentSchema,
  upsertItemsSchema,
} from "../../shared/contract.ts";
import type { FamilyService } from "../services/families.ts";
import type { ListService } from "../services/lists.ts";
import { type Env, readJson, requireSession } from "./context.ts";
import type { Notifier } from "./notifier.ts";

export function listRoutes(families: FamilyService, lists: ListService, notifier: Notifier) {
  const routes = new Hono<Env>();
  routes.use("*", requireSession(families));

  routes.get("/list", async (c) => c.json(await lists.snapshot(c.get("session").familyId)));

  routes.put("/items", async (c) => {
    const { familyId } = c.get("session");
    const { items } = await readJson(c, upsertItemsSchema);
    await lists.upsertItems(familyId, items);
    await notifier.broadcast(familyId);
    return c.body(null, 204);
  });

  routes.post("/items/delete", async (c) => {
    const { familyId } = c.get("session");
    const { ids } = await readJson(c, deleteItemsSchema);
    await lists.deleteItems(familyId, ids);
    await notifier.broadcast(familyId);
    return c.body(null, 204);
  });

  routes.post("/categories", async (c) => {
    const { familyId } = c.get("session");
    const { name } = await readJson(c, addCategorySchema);
    await lists.addCategory(familyId, name);
    await notifier.broadcast(familyId);
    return c.body(null, 204);
  });

  routes.post("/purchases", async (c) => {
    const { familyId, name } = c.get("session");
    const { purchase, itemIds } = await readJson(c, finishSchema);
    // Quem registrou vem da sessão, nunca do que o aparelho mandou.
    await lists.finish(familyId, name, purchase, itemIds);
    await notifier.broadcast(familyId);
    return c.body(null, 204);
  });

  routes.put("/purchases/:id", async (c) => {
    const { familyId } = c.get("session");
    const payment = await readJson(c, paymentSchema);
    if (!(await lists.updatePurchase(familyId, c.req.param("id"), payment))) {
      throw new HTTPException(404, { message: "Compra não encontrada" });
    }
    await notifier.broadcast(familyId);
    return c.body(null, 204);
  });

  routes.get("/events", (c) => {
    if (c.req.header("upgrade") !== "websocket") {
      throw new HTTPException(426, { message: "Esperado WebSocket" });
    }
    const { familyId, memberId } = c.get("session");
    return notifier.connect(familyId, memberId, c.req.raw);
  });

  return routes;
}
