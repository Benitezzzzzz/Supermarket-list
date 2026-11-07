import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { HTTPException } from "hono/http-exception";
import { secureHeaders } from "hono/secure-headers";
import type { Database } from "./db/database.ts";
import { adminRoutes } from "./http/adminRoutes.ts";
import { authRoutes } from "./http/authRoutes.ts";
import { listRoutes } from "./http/listRoutes.ts";
import type { Notifier } from "./http/notifier.ts";
import { AccountService } from "./services/accounts.ts";
import { ListService } from "./services/lists.ts";
import { MembershipService } from "./services/memberships.ts";

const MAX_BODY_BYTES = 512 * 1024;

export function createApp(db: Database, notifier: Notifier) {
  const accounts = new AccountService(db);
  const lists = new ListService(db);
  const memberships = new MembershipService(db);

  const api = new Hono();
  api.use(
    "*",
    bodyLimit({
      maxSize: MAX_BODY_BYTES,
      onError: (c) => c.json({ error: "Envio grande demais" }, 413),
    }),
  );
  api.route("/auth", authRoutes(accounts, memberships));
  api.route("/admin", adminRoutes(accounts));
  api.route("/lists", listRoutes({ accounts, lists, memberships, notifier }));

  const app = new Hono();
  app.use("*", secureHeaders({ crossOriginResourcePolicy: "same-origin" }));
  app.route("/api", api);
  app.notFound((c) => c.json({ error: "Rota não encontrada" }, 404));
  app.onError((error, c) => {
    if (error instanceof HTTPException) {
      return c.json({ error: error.message }, error.status);
    }
    console.error(error);
    return c.json({ error: "Erro interno" }, 500);
  });
  return app;
}
