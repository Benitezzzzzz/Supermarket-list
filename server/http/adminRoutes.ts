import { Hono } from "hono";
import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import { adminPasswordSchema } from "../../shared/contract.ts";
import type { AccountService } from "../services/accounts.ts";
import { type Env, readJson, requireUser } from "./context.ts";

const requireSuperAdmin = createMiddleware<Env>(async (c, next) => {
  if (!c.get("user").isSuperAdmin) {
    throw new HTTPException(403, { message: "Só o administrador geral pode fazer isso" });
  }
  await next();
});

/** Painel do administrador geral: todas as contas e listas. */
export function adminRoutes(accounts: AccountService) {
  const routes = new Hono<Env>();
  routes.use("*", requireUser(accounts), requireSuperAdmin);

  routes.get("/overview", async (c) => c.json(await accounts.overview()));

  /**
   * O aparelho do administrador gera a senha nova e manda só a chave derivada:
   * a senha em texto continua sem passar pelo servidor.
   */
  routes.put("/users/:userId/password", async (c) => {
    const { passwordKey } = await readJson(c, adminPasswordSchema);
    if (!(await accounts.adminSetPassword(c.req.param("userId"), passwordKey))) {
      throw new HTTPException(404, { message: "Conta não encontrada" });
    }
    return c.body(null, 204);
  });

  routes.post("/users/:userId/logout", async (c) => {
    await accounts.logoutEverywhere(c.req.param("userId"));
    return c.body(null, 204);
  });

  return routes;
}
