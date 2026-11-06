import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import {
  addCategorySchema,
  deleteItemsSchema,
  upsertItemsSchema,
} from "../../shared/contract.ts";
import type { FamilyService } from "../services/families.ts";
import type { ListService } from "../services/lists.ts";
import { type Env, readJson, requireSession } from "./context.ts";
import type { EventHub } from "./eventHub.ts";

const HEARTBEAT_MS = 25_000;

export function listRoutes(families: FamilyService, lists: ListService, hub: EventHub) {
  const routes = new Hono<Env>();
  routes.use("*", requireSession(families));

  routes.get("/list", (c) => c.json(lists.snapshot(c.get("session").familyId)));

  routes.put("/items", async (c) => {
    const { familyId } = c.get("session");
    const { items } = await readJson(c, upsertItemsSchema);
    lists.upsertItems(familyId, items);
    hub.broadcast(familyId);
    return c.body(null, 204);
  });

  routes.post("/items/delete", async (c) => {
    const { familyId } = c.get("session");
    const { ids } = await readJson(c, deleteItemsSchema);
    lists.deleteItems(familyId, ids);
    hub.broadcast(familyId);
    return c.body(null, 204);
  });

  routes.post("/categories", async (c) => {
    const { familyId } = c.get("session");
    const { name } = await readJson(c, addCategorySchema);
    lists.addCategory(familyId, name);
    hub.broadcast(familyId);
    return c.body(null, 204);
  });

  routes.get("/events", (c) => {
    const { familyId, memberId } = c.get("session");

    return streamSSE(c, async (stream) => {
      let open = true;
      let wake = () => {};
      const close = () => {
        open = false;
        wake();
      };
      const remove = hub.add(familyId, {
        memberId,
        close,
        notify: () => void stream.writeSSE({ event: "change", data: "" }).catch(close),
      });
      stream.onAbort(close);

      await stream.writeSSE({ event: "ready", data: "" });
      while (open) {
        await new Promise<void>((resolve) => {
          wake = resolve;
          setTimeout(resolve, HEARTBEAT_MS).unref();
        });
        // O comentário mantém a conexão viva em proxies que encerram canais parados.
        if (open) await stream.write(": ping\n\n").catch(close);
      }
      remove();
    });
  });

  return routes;
}
