// @vitest-environment node
import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import type { Item, SessionInfo } from "../shared/contract.ts";
import { createApp } from "./app.ts";
import type { Database } from "./db/database.ts";
import { openTestDatabase } from "./db/sqliteAdapter.ts";
import type { Notifier } from "./http/notifier.ts";
import { FamilyService } from "./services/families.ts";

type App = ReturnType<typeof createApp>;

/** Registra os avisos que iriam para o Durable Object. */
class RecordingNotifier implements Notifier {
  broadcasts: string[] = [];
  disconnects: string[] = [];
  async broadcast(familyId: string) {
    this.broadcasts.push(familyId);
  }
  async disconnectMember(familyId: string, memberId: string) {
    this.disconnects.push(`${familyId}/${memberId}`);
  }
  async connect() {
    return new Response("conectado");
  }
}

function item(overrides: Partial<Item> = {}): Item {
  return {
    id: randomUUID(),
    text: "Arroz",
    quantity: 1,
    done: false,
    category: "Outros",
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

/** Aparelho de teste: guarda o cookie como um navegador faria. */
class Device {
  cookie = "";
  private app: App;

  constructor(app: App) {
    this.app = app;
  }

  async call(method: string, path: string, body?: unknown) {
    const headers: Record<string, string> = {};
    if (this.cookie) headers.cookie = this.cookie;
    if (body !== undefined) headers["content-type"] = "application/json";
    const response = await this.app.request(`/api${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const setCookie = response.headers.get("set-cookie");
    if (setCookie) this.cookie = setCookie.split(";")[0];
    return response;
  }

  async join(inviteToken: string, name: string): Promise<SessionInfo> {
    const response = await this.call("POST", "/session", { inviteToken, name });
    expect(response.ok).toBe(true);
    return response.json() as Promise<SessionInfo>;
  }

  async items(): Promise<Item[]> {
    const response = await this.call("GET", "/list");
    expect(response.status).toBe(200);
    return ((await response.json()) as { items: Item[] }).items;
  }
}

describe("API", () => {
  let db: Database;
  let app: App;
  let inviteA: string;
  let inviteB: string;
  let admin: Device;
  let member: Device;
  let outsider: Device;
  let notifier: RecordingNotifier;
  let familyA: string;

  beforeEach(async () => {
    db = openTestDatabase();
    notifier = new RecordingNotifier();
    app = createApp(db, notifier);
    const families = new FamilyService(db);
    const a = await families.create("Família A");
    familyA = a.familyId;
    inviteA = a.inviteToken;
    inviteB = (await families.create("Família B")).inviteToken;
    admin = new Device(app);
    member = new Device(app);
    outsider = new Device(app);
    await admin.join(inviteA, "Renan");
    await member.join(inviteA, "Mãe");
    await outsider.join(inviteB, "Vizinho");
  });

  describe("autenticação", () => {
    it.each([
      ["GET", "/list"],
      ["GET", "/events"],
      ["PUT", "/items"],
      ["POST", "/items/delete"],
      ["POST", "/categories"],
      ["POST", "/purchases"],
      ["GET", "/family/members"],
      ["GET", "/family"],
      ["PUT", "/family/entry"],
      ["GET", "/session"],
    ])("%s %s exige sessão", async (method, path) => {
      const response = await new Device(app).call(method, path);
      expect(response.status).toBe(401);
    });

    it("recusa cookie forjado", async () => {
      const device = new Device(app);
      device.cookie = `lista_sessao=${"a".repeat(64)}`;
      expect((await device.call("GET", "/list")).status).toBe(401);
    });

    it("recusa convite inválido", async () => {
      const response = await new Device(app).call("POST", "/session", {
        inviteToken: "f".repeat(64),
        name: "Intruso",
      });
      expect(response.status).toBe(404);
    });

    it("sem convite, não entra quando o app tem mais de uma família", async () => {
      const response = await new Device(app).call("POST", "/session", { name: "Intruso" });
      expect(response.status).toBe(404);
    });

    it("usa cookie httpOnly e SameSite Strict", async () => {
      const response = await new Device(app).call("POST", "/session", {
        inviteToken: inviteA,
        name: "Pai",
      });
      const cookie = response.headers.get("set-cookie")!;
      expect(cookie).toContain("HttpOnly");
      expect(cookie).toContain("SameSite=Strict");
    });

    it("marca o cookie como Secure atrás de proxy HTTPS", async () => {
      const response = await app.request("/api/session", {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-proto": "https" },
        body: JSON.stringify({ inviteToken: inviteA, name: "Pai" }),
      });
      expect(response.headers.get("set-cookie")).toContain("Secure");
    });

    it("não guarda convite nem sessão em texto puro", async () => {
      const rows = await db.prepare("SELECT invite_hash FROM families").all();
      expect(JSON.stringify(rows)).not.toContain(inviteA);
      const token = admin.cookie.split("=")[1];
      const sessions = await db.prepare("SELECT session_hash FROM members").all();
      expect(JSON.stringify(sessions)).not.toContain(token);
    });

    it("não duplica o membro quando o aparelho reabre o link", async () => {
      await admin.join(inviteA, "Renan");
      const members = (await (await admin.call("GET", "/family/members")).json()) as unknown[];
      expect(members).toHaveLength(2);
    });
  });

  describe("isolamento entre famílias", () => {
    it("família não vê itens de outra", async () => {
      await admin.call("PUT", "/items", { items: [item()] });
      expect(await outsider.items()).toEqual([]);
    });

    it("não altera item de outra família usando o mesmo id", async () => {
      const original = item({ text: "Original" });
      await admin.call("PUT", "/items", { items: [original] });
      await outsider.call("PUT", "/items", { items: [{ ...original, text: "Hackeado" }] });
      expect((await admin.items())[0].text).toBe("Original");
    });

    it("não apaga item de outra família", async () => {
      const original = item();
      await admin.call("PUT", "/items", { items: [original] });
      await outsider.call("POST", "/items/delete", { ids: [original.id] });
      expect(await admin.items()).toHaveLength(1);
    });

    it("não vê nem remove membros de outra família", async () => {
      const list = (await (await admin.call("GET", "/family/members")).json()) as { id: string }[];
      expect(list).toHaveLength(2);

      const other = await new Device(app).join(inviteB, "Segundo");
      const response = await admin.call("DELETE", `/family/members/${other.memberId}`);
      expect(response.status).toBe(404);
    });
  });

  describe("lista", () => {
    it("compartilha itens entre membros da família", async () => {
      const novo = item({ text: "Feijão", quantity: 3 });
      expect((await admin.call("PUT", "/items", { items: [novo] })).status).toBe(204);
      expect(await member.items()).toEqual([novo]);
    });

    it("é idempotente: reenviar não duplica", async () => {
      const novo = item();
      await admin.call("PUT", "/items", { items: [novo] });
      await admin.call("PUT", "/items", { items: [novo] });
      await admin.call("POST", "/items/delete", { ids: [novo.id] });
      const again = await admin.call("POST", "/items/delete", { ids: [novo.id] });
      expect(again.status).toBe(204);
    });

    it("ignora categoria repetida com maiúsculas diferentes", async () => {
      await admin.call("POST", "/categories", { name: "Pet" });
      await admin.call("POST", "/categories", { name: "PET" });
      const snapshot = (await (await admin.call("GET", "/list")).json()) as {
        customCategories: string[];
      };
      expect(snapshot.customCategories).toEqual(["Pet"]);
    });

    it.each([
      ["texto vazio", { text: "   " }],
      ["texto longo", { text: "x".repeat(81) }],
      ["quantidade zero", { quantity: 0 }],
      ["quantidade fracionada", { quantity: 1.5 }],
      ["id inválido", { id: "1 OR 1=1" }],
      ["data inválida", { createdAt: "ontem" }],
    ])("recusa %s", async (_name, overrides) => {
      const response = await admin.call("PUT", "/items", { items: [item(overrides)] });
      expect(response.status).toBe(422);
      expect(await admin.items()).toEqual([]);
    });

    it("recusa escrita que não seja JSON", async () => {
      const response = await app.request("/api/items", {
        method: "PUT",
        headers: { cookie: admin.cookie, "content-type": "text/plain" },
        body: "{}",
      });
      expect(response.status).toBe(415);
    });
  });

  describe("finalizar compra", () => {
    const purchase = (overrides: Record<string, unknown> = {}) => ({
      id: randomUUID(),
      amountCents: 15290,
      method: "credito",
      installments: 3,
      itemCount: 1,
      memberName: "Quem mandou",
      createdAt: new Date().toISOString(),
      ...overrides,
    });
    const purchases = async (device: Device) =>
      ((await (await device.call("GET", "/list")).json()) as { purchases: { id: string; memberName: string }[] }).purchases;

    it("guarda a compra e tira só os itens informados", async () => {
      const antigo = item({ text: "Arroz" });
      const novo = item({ text: "Feijão" });
      await admin.call("PUT", "/items", { items: [antigo, novo] });

      const compra = purchase();
      const response = await member.call("POST", "/purchases", { purchase: compra, itemIds: [antigo.id] });
      expect(response.status).toBe(204);

      expect((await admin.items()).map((i) => i.text)).toEqual(["Feijão"]);
      const saved = await purchases(admin);
      expect(saved.map((p) => p.id)).toEqual([compra.id]);
      // Quem registrou vem da sessão, não do que o aparelho mandou.
      expect(saved[0].memberName).toBe("Mãe");
    });

    it("reenviar a mesma compra não duplica", async () => {
      const compra = purchase();
      await admin.call("POST", "/purchases", { purchase: compra, itemIds: [] });
      await admin.call("POST", "/purchases", { purchase: compra, itemIds: [] });
      expect(await purchases(admin)).toHaveLength(1);
    });

    it("outra família não vê nem apaga", async () => {
      const meu = item();
      await admin.call("PUT", "/items", { items: [meu] });
      await outsider.call("POST", "/purchases", { purchase: purchase(), itemIds: [meu.id] });
      expect(await admin.items()).toHaveLength(1);
      expect(await purchases(admin)).toEqual([]);
    });

    it.each([
      ["PIX parcelado", { method: "pix", installments: 2 }],
      ["dinheiro parcelado", { method: "dinheiro", installments: 2 }],
      ["débito parcelado", { method: "debito", installments: 3 }],
      ["valor zero", { amountCents: 0 }],
      ["valor fracionado", { amountCents: 10.5 }],
      ["forma desconhecida", { method: "boleto" }],
      ["parcelas demais", { installments: 25 }],
    ])("recusa %s", async (_name, overrides) => {
      const response = await admin.call("POST", "/purchases", { purchase: purchase(overrides), itemIds: [] });
      expect(response.status).toBe(422);
      expect(await purchases(admin)).toEqual([]);
    });

    it("aceita dinheiro em espécie", async () => {
      const response = await admin.call("POST", "/purchases", {
        purchase: purchase({ method: "dinheiro", installments: 1 }),
        itemIds: [],
      });
      expect(response.status).toBe(204);
    });

    it("corrige valor e forma de pagamento", async () => {
      const compra = purchase();
      await admin.call("POST", "/purchases", { purchase: compra, itemIds: [] });
      const response = await member.call("PUT", `/purchases/${compra.id}`, {
        amountCents: 9850,
        method: "dinheiro",
        installments: 1,
      });
      expect(response.status).toBe(204);
      const [saved] = (await (await admin.call("GET", "/list")).json()).purchases;
      expect([saved.amountCents, saved.method, saved.installments, saved.id]).toEqual([9850, "dinheiro", 1, compra.id]);
    });

    it("não corrige compra de outra família", async () => {
      const compra = purchase();
      await admin.call("POST", "/purchases", { purchase: compra, itemIds: [] });
      const response = await outsider.call("PUT", `/purchases/${compra.id}`, {
        amountCents: 1,
        method: "pix",
        installments: 1,
      });
      expect(response.status).toBe(404);
      const [saved] = (await (await admin.call("GET", "/list")).json()).purchases;
      expect(saved.amountCents).toBe(15290);
    });

    it.each([
      ["valor zero", { amountCents: 0, method: "pix", installments: 1 }],
      ["débito parcelado", { amountCents: 100, method: "debito", installments: 2 }],
    ])("recusa correção com %s", async (_name, payment) => {
      const compra = purchase();
      await admin.call("POST", "/purchases", { purchase: compra, itemIds: [] });
      expect((await admin.call("PUT", `/purchases/${compra.id}`, payment)).status).toBe(422);
    });

    it("avisa a família em tempo real", async () => {
      notifier.broadcasts = [];
      await admin.call("POST", "/purchases", { purchase: purchase(), itemIds: [] });
      expect(notifier.broadcasts).toEqual([familyA]);
    });
  });

  describe("tempo real", () => {
    it("avisa só a família que mudou", async () => {
      notifier.broadcasts = [];
      await admin.call("PUT", "/items", { items: [item()] });
      await admin.call("POST", "/categories", { name: "Pet" });
      expect(notifier.broadcasts).toEqual([familyA, familyA]);
    });

    it("escrita recusada não gera aviso", async () => {
      notifier.broadcasts = [];
      await admin.call("PUT", "/items", { items: [item({ text: "" })] });
      expect(notifier.broadcasts).toEqual([]);
    });

    it("exige WebSocket para abrir o canal", async () => {
      expect((await admin.call("GET", "/events")).status).toBe(426);
    });

    it("entrega o canal com o membro da sessão", async () => {
      const response = await app.request("/api/events", {
        headers: { cookie: admin.cookie, upgrade: "websocket" },
      });
      expect(await response.text()).toBe("conectado");
    });

    it("desconecta na hora o membro removido", async () => {
      const session = (await (await member.call("GET", "/session")).json()) as SessionInfo;
      await admin.call("DELETE", `/family/members/${session.memberId}`);
      expect(notifier.disconnects).toEqual([`${familyA}/${session.memberId}`]);
    });
  });

  describe("gestão da família", () => {
    it("o primeiro a entrar é admin e os demais são membros", async () => {
      const list = (await (await member.call("GET", "/family/members")).json()) as {
        name: string;
        role: string;
      }[];
      expect(list.map((m) => [m.name, m.role])).toEqual([
        ["Renan", "admin"],
        ["Mãe", "member"],
      ]);
    });

    it("membro comum não remove ninguém nem mexe na entrada", async () => {
      const session = (await (await admin.call("GET", "/session")).json()) as SessionInfo;
      expect((await member.call("DELETE", `/family/members/${session.memberId}`)).status).toBe(403);
      expect((await member.call("PUT", "/family/entry", { open: false })).status).toBe(403);
    });

    it("membro removido perde o acesso na hora", async () => {
      const session = (await (await member.call("GET", "/session")).json()) as SessionInfo;
      const response = await admin.call("DELETE", `/family/members/${session.memberId}`);
      expect(response.status).toBe(204);
      expect((await member.call("GET", "/list")).status).toBe(401);
    });

    it("admin não remove a si mesmo", async () => {
      const session = (await (await admin.call("GET", "/session")).json()) as SessionInfo;
      expect((await admin.call("DELETE", `/family/members/${session.memberId}`)).status).toBe(400);
    });

    it("fechar a entrada barra gente nova sem derrubar quem já entrou", async () => {
      const closed = await admin.call("PUT", "/family/entry", { open: false });
      expect(await closed.json()).toEqual({ openJoin: false });

      const late = new Device(app);
      const refused = await late.call("POST", "/session", { inviteToken: inviteA, name: "Atrasado" });
      expect(refused.status).toBe(403);
      expect((await member.call("GET", "/list")).status).toBe(200);

      await admin.call("PUT", "/family/entry", { open: true });
      expect((await late.call("POST", "/session", { inviteToken: inviteA, name: "Novo" })).status).toBe(201);
    });

    it("fechar a entrada de uma família não afeta outra", async () => {
      await admin.call("PUT", "/family/entry", { open: false });
      const settings = (await (await outsider.call("GET", "/family")).json()) as { openJoin: boolean };
      expect(settings.openJoin).toBe(true);
    });
  });
});

/** O app publicado tem uma família só: entra-se pelo endereço, sem convite. */
describe("entrada pelo endereço", () => {
  let app: App;
  let db: Database;

  beforeEach(async () => {
    db = openTestDatabase();
    app = createApp(db, new RecordingNotifier());
    await new FamilyService(db).create("Família Benitez");
  });

  const joinByName = (device: Device, name: string) => device.call("POST", "/session", { name });

  it("o primeiro a entrar só com o nome vira admin", async () => {
    const first = new Device(app);
    const response = await joinByName(first, "Renan");
    expect(response.status).toBe(201);
    expect(((await response.json()) as SessionInfo).role).toBe("admin");

    const second = await joinByName(new Device(app), "Mãe");
    expect(((await second.json()) as SessionInfo).role).toBe("member");
  });

  it("o mesmo aparelho entrando de novo não duplica", async () => {
    const device = new Device(app);
    await joinByName(device, "Renan");
    await joinByName(device, "Renan");
    const members = (await (await device.call("GET", "/family/members")).json()) as unknown[];
    expect(members).toHaveLength(1);
  });

  it("com a entrada fechada, ninguém novo entra", async () => {
    const admin = new Device(app);
    await joinByName(admin, "Renan");
    await admin.call("PUT", "/family/entry", { open: false });

    const response = await joinByName(new Device(app), "Estranho");
    expect(response.status).toBe(403);
    expect(((await response.json()) as { error: string }).error).toContain("fechada");
  });

  it("valida o nome", async () => {
    expect((await joinByName(new Device(app), "   ")).status).toBe(422);
  });
});
