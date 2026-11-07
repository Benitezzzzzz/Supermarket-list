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
import type { ReceiptReader } from "./services/receiptReader.ts";
import { ReceiptService } from "./services/receipts.ts";

const MAX_BODY_BYTES = 512 * 1024;
/** A foto do cupom já chega reduzida pelo aparelho; em base64 fica abaixo disso. */
const MAX_PHOTO_BYTES = 6 * 1024 * 1024;

export function createApp(db: Database, notifier: Notifier, reader: ReceiptReader | null = null) {
  const accounts = new AccountService(db);
  const lists = new ListService(db);
  const memberships = new MembershipService(db);
  const receipts = new ReceiptService(db);

  const api = new Hono();
  const limit = (maxSize: number) =>
    bodyLimit({ maxSize, onError: (c) => c.json({ error: "Envio grande demais" }, 413) });
  const regularLimit = limit(MAX_BODY_BYTES);
  const photoLimit = limit(MAX_PHOTO_BYTES);
  api.use("*", (c, next) => (c.req.path.endsWith("/receipts/read") ? photoLimit : regularLimit)(c, next));
  api.route("/auth", authRoutes(accounts, memberships));
  api.route("/admin", adminRoutes(accounts));
  api.route("/lists", listRoutes({ accounts, lists, memberships, notifier, receipts, reader }));

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
