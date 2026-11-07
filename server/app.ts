import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { HTTPException } from "hono/http-exception";
import { secureHeaders } from "hono/secure-headers";
import type { Database } from "./db/database.ts";
import { familyRoutes } from "./http/familyRoutes.ts";
import { listRoutes } from "./http/listRoutes.ts";
import type { Notifier } from "./http/notifier.ts";
import { sessionRoutes } from "./http/sessionRoutes.ts";
import { FamilyService } from "./services/families.ts";
import { ListService } from "./services/lists.ts";

const MAX_BODY_BYTES = 512 * 1024;

export function createApp(db: Database, notifier: Notifier) {
  const families = new FamilyService(db);
  const lists = new ListService(db);

  const api = new Hono();
  api.use(
    "*",
    bodyLimit({
      maxSize: MAX_BODY_BYTES,
      onError: (c) => c.json({ error: "Envio grande demais" }, 413),
    }),
  );
  api.route("/session", sessionRoutes(families));
  api.route("/family", familyRoutes(families, notifier));
  api.route("/", listRoutes(families, lists, notifier));

  const app = new Hono();
  app.use("*", secureHeaders({ crossOriginResourcePolicy: "same-origin" }));
  app.route("/api", api);
  app.onError((error, c) => {
    if (error instanceof HTTPException) {
      return c.json({ error: error.message }, error.status);
    }
    console.error(error);
    return c.json({ error: "Erro interno" }, 500);
  });
  return app;
}
