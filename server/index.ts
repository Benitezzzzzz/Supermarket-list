import { readFileSync } from "node:fs";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { createApp } from "./app.ts";
import { config } from "./config.ts";
import { openDatabase } from "./db/database.ts";

const db = openDatabase(config.databasePath);
const app = createApp(db);

// Em desenvolvimento quem serve o frontend é o Vite; dist só existe depois do build.
app.use("*", serveStatic({ root: "./dist" }));
app.get("*", (c) => {
  if (c.req.path.startsWith("/api/")) return c.json({ error: "Rota não encontrada" }, 404);
  try {
    return c.html(readFileSync("dist/index.html", "utf8"));
  } catch {
    return c.text("Frontend não gerado. Rode npm run build.", 503);
  }
});

const server = serve({ fetch: app.fetch, port: config.port, hostname: config.host }, (info) => {
  console.log(`Lista do Mercado em http://localhost:${info.port}`);
});

function shutdown() {
  server.close();
  db.close();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
