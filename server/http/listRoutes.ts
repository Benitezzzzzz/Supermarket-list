import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import {
  addCategorySchema,
  addMemberSchema,
  deleteItemsSchema,
  finishSchema,
  listNameSchema,
  paymentSchema,
  readReceiptSchema,
  receiptSchema,
  upsertItemsSchema,
} from "../../shared/contract.ts";
import type { AccountService } from "../services/accounts.ts";
import type { ListService } from "../services/lists.ts";
import type { MembershipService } from "../services/memberships.ts";
import { normalizeReading, ReaderUnavailableError, type ReceiptReader } from "../services/receiptReader.ts";
import type { ReceiptService } from "../services/receipts.ts";
import { type Env, readJson, requireListAccess, requireListAdmin, requireUser } from "./context.ts";
import type { Notifier } from "./notifier.ts";

interface Deps {
  accounts: AccountService;
  lists: ListService;
  memberships: MembershipService;
  notifier: Notifier;
  receipts: ReceiptService;
  /** null quando a IA não está configurada (testes, desenvolvimento sem conta). */
  reader: ReceiptReader | null;
}

/** Rotas de uma lista: /api/lists/:listId/... Só entra quem participa dela. */
function oneList({ lists, memberships, notifier, receipts, reader }: Deps) {
  const routes = new Hono<Env>();
  routes.use("*", requireListAccess(memberships));

  /** Toda escrita avisa os outros aparelhos da mesma lista. */
  const changed = async (listId: string) => notifier.broadcast(listId);

  routes.get("/", async (c) => c.json(await lists.snapshot(c.get("listId"))));

  routes.patch("/", requireListAdmin, async (c) => {
    const { name } = await readJson(c, listNameSchema);
    await lists.rename(c.get("listId"), name);
    return c.json({ id: c.get("listId"), name, role: c.get("role") });
  });

  routes.delete("/", requireListAdmin, async (c) => {
    const listId = c.get("listId");
    const members = await memberships.members(listId);
    await lists.delete(listId);
    await Promise.all(members.map((member) => notifier.disconnectMember(listId, member.userId)));
    return c.body(null, 204);
  });

  routes.post("/leave", async (c) => {
    if (c.get("role") === "admin") {
      throw new HTTPException(400, { message: "Quem administra não pode sair. Para encerrar, exclua a lista." });
    }
    await memberships.remove(c.get("listId"), c.get("user").id);
    return c.body(null, 204);
  });

  routes.get("/members", async (c) => c.json(await memberships.members(c.get("listId"))));

  routes.post("/members", requireListAdmin, async (c) => {
    const { username } = await readJson(c, addMemberSchema);
    const result = await memberships.add(c.get("listId"), username);
    if (!result.ok && result.reason === "not_found") {
      throw new HTTPException(404, { message: "Não encontrei esse usuário. Confira como a pessoa escreveu." });
    }
    if (!result.ok) throw new HTTPException(409, { message: "Essa pessoa já participa da lista." });
    return c.json(result.member, 201);
  });

  routes.delete("/members/:userId", requireListAdmin, async (c) => {
    const listId = c.get("listId");
    const target = c.req.param("userId");
    if (target === c.get("user").id) {
      throw new HTTPException(400, { message: "Quem administra não pode remover a si mesmo" });
    }
    if (!(await memberships.remove(listId, target))) {
      throw new HTTPException(404, { message: "Participante não encontrado" });
    }
    await notifier.disconnectMember(listId, target);
    return c.body(null, 204);
  });

  routes.put("/items", async (c) => {
    const { items } = await readJson(c, upsertItemsSchema);
    await lists.upsertItems(c.get("listId"), items);
    await changed(c.get("listId"));
    return c.body(null, 204);
  });

  routes.post("/items/delete", async (c) => {
    const { ids } = await readJson(c, deleteItemsSchema);
    await lists.deleteItems(c.get("listId"), ids);
    await changed(c.get("listId"));
    return c.body(null, 204);
  });

  routes.post("/categories", async (c) => {
    const { name } = await readJson(c, addCategorySchema);
    await lists.addCategory(c.get("listId"), name);
    await changed(c.get("listId"));
    return c.body(null, 204);
  });

  routes.post("/purchases", async (c) => {
    const { purchase, itemIds } = await readJson(c, finishSchema);
    // Quem registrou vem da conta, nunca do que o aparelho mandou.
    await lists.finish(c.get("listId"), c.get("user").displayName, purchase, itemIds);
    await changed(c.get("listId"));
    return c.body(null, 204);
  });

  routes.put("/purchases/:id", async (c) => {
    const payment = await readJson(c, paymentSchema);
    if (!(await lists.updatePurchase(c.get("listId"), c.req.param("id"), payment))) {
      throw new HTTPException(404, { message: "Compra não encontrada" });
    }
    await changed(c.get("listId"));
    return c.body(null, 204);
  });

  routes.delete("/purchases/:id", async (c) => {
    await lists.deletePurchase(c.get("listId"), c.req.param("id"));
    await changed(c.get("listId"));
    return c.body(null, 204);
  });

  routes.post("/purchases/:id/restore", async (c) => {
    await lists.restorePurchase(c.get("listId"), c.req.param("id"));
    await changed(c.get("listId"));
    return c.body(null, 204);
  });

  routes.put("/purchases/:id/receipt", async (c) => {
    const receipt = await readJson(c, receiptSchema);
    const result = await receipts.save(c.get("listId"), c.req.param("id"), receipt);
    if (!result.ok && result.reason === "purchase") {
      throw new HTTPException(404, { message: "Compra não encontrada" });
    }
    if (!result.ok && result.reason === "duplicate") {
      const day = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Fortaleza" })
        .format(new Date(result.purchaseCreatedAt));
      throw new HTTPException(409, { message: `Este cupom já está ligado à compra de ${day}.` });
    }
    await changed(c.get("listId"));
    return c.body(null, 204);
  });

  routes.delete("/purchases/:id/receipt", async (c) => {
    await receipts.remove(c.get("listId"), c.req.param("id"));
    await changed(c.get("listId"));
    return c.body(null, 204);
  });

  /** Lê a foto do cupom com a IA. Não grava nada: a pessoa revisa antes de salvar. */
  routes.post("/receipts/read", async (c) => {
    if (!reader) throw new HTTPException(503, { message: "A leitura de cupom não está disponível agora." });
    const { image } = await readJson(c, readReceiptSchema);
    if (!(await receipts.countRead(c.get("listId")))) {
      throw new HTTPException(429, { message: "Esta lista já leu muitos cupons hoje. Tente de novo amanhã." });
    }
    let raw: unknown;
    try {
      raw = await reader.read(image);
    } catch (error) {
      if (error instanceof ReaderUnavailableError) {
        console.error("leitura de cupom:", error.message);
        throw new HTTPException(error.quotaExceeded ? 429 : 503, {
          message: error.quotaExceeded
            ? "Acabaram as leituras grátis de hoje. Tente de novo amanhã."
            : "Não consegui ler agora. Tente de novo em instantes.",
        });
      }
      throw error;
    }
    const reading = normalizeReading(raw);
    if (reading.items.length === 0) {
      throw new HTTPException(422, {
        message: "Não encontrei produtos na foto. Tire outra com o cupom inteiro, reto e bem iluminado.",
      });
    }
    return c.json(reading);
  });

  routes.get("/events", (c) => {
    if (c.req.header("upgrade") !== "websocket") {
      throw new HTTPException(426, { message: "Esperado WebSocket" });
    }
    return notifier.connect(c.get("listId"), c.get("user").id, c.req.raw);
  });

  return routes;
}

export function listRoutes(deps: Deps) {
  const routes = new Hono<Env>();
  routes.use("*", requireUser(deps.accounts));

  routes.post("/", async (c) => {
    const { name } = await readJson(c, listNameSchema);
    return c.json(await deps.lists.create(c.get("user").id, name), 201);
  });

  routes.route("/:listId", oneList(deps));
  return routes;
}
