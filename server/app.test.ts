// @vitest-environment node
import { randomBytes, randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import type { Item, ListMember, ListSummary, MeResponse, Purchase, Snapshot } from "../shared/contract.ts";
import { createApp } from "./app.ts";
import type { Database } from "./db/database.ts";
import { openTestDatabase } from "./db/sqliteAdapter.ts";
import type { Notifier } from "./http/notifier.ts";
import { hashToken } from "./services/tokens.ts";

type App = ReturnType<typeof createApp>;

/** Registra os avisos que iriam para o Durable Object. */
class RecordingNotifier implements Notifier {
  broadcasts: string[] = [];
  disconnects: string[] = [];
  async broadcast(listId: string) {
    this.broadcasts.push(listId);
  }
  async disconnectMember(listId: string, userId: string) {
    this.disconnects.push(`${listId}/${userId}`);
  }
  async connect() {
    return new Response("conectado");
  }
}

const key = () => randomBytes(32).toString("hex");

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

/** Aparelho de teste: guarda os cookies como um navegador faria. */
class Device {
  cookies = new Map<string, string>();
  passwordKey = key();
  me?: MeResponse;
  private app: App;

  constructor(app: App) {
    this.app = app;
  }

  get cookie() {
    return [...this.cookies].map(([name, value]) => `${name}=${value}`).join("; ");
  }

  async call(method: string, path: string, body?: unknown, extraHeaders: Record<string, string> = {}) {
    const headers: Record<string, string> = { ...extraHeaders };
    if (this.cookies.size) headers.cookie = this.cookie;
    if (body !== undefined) headers["content-type"] = "application/json";
    const response = await this.app.request(`/api${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    for (const line of response.headers.getSetCookie()) {
      const [pair] = line.split(";");
      const [name, value] = pair.split("=");
      if (value && !/Max-Age=0/i.test(line)) this.cookies.set(name, value);
      else this.cookies.delete(name);
    }
    return response;
  }

  async signup(username: string, displayName: string) {
    const response = await this.call("POST", "/auth/signup", { username, displayName, passwordKey: this.passwordKey });
    expect(response.status).toBe(201);
    this.me = (await response.json()) as MeResponse;
    return this.me;
  }

  async createList(name: string): Promise<ListSummary> {
    const response = await this.call("POST", "/lists", { name });
    expect(response.status).toBe(201);
    return response.json() as Promise<ListSummary>;
  }

  async snapshot(listId: string): Promise<Snapshot> {
    const response = await this.call("GET", `/lists/${listId}`);
    expect(response.status).toBe(200);
    return response.json() as Promise<Snapshot>;
  }
}

let db: Database;
let app: App;
let notifier: RecordingNotifier;

beforeEach(() => {
  db = openTestDatabase();
  notifier = new RecordingNotifier();
  app = createApp(db, notifier);
});

describe("contas", () => {
  it("cria conta e já entra", async () => {
    const renan = new Device(app);
    const me = await renan.signup("Renan", "Renan Benitez");
    expect(me.user.username).toBe("renan");
    expect(me.lists).toEqual([]);
    const again = (await (await renan.call("GET", "/auth/me")).json()) as MeResponse;
    expect(again.user.displayName).toBe("Renan Benitez");
  });

  it("não deixa repetir usuário, nem com maiúsculas", async () => {
    await new Device(app).signup("renan", "Renan");
    const other = new Device(app);
    const response = await other.call("POST", "/auth/signup", { username: "RENAN", displayName: "Outro", passwordKey: key() });
    expect(response.status).toBe(409);
  });

  it.each([
    ["usuário curto", { username: "ab" }],
    ["usuário com espaço", { username: "meu pai" }],
    ["usuário com acento", { username: "joão" }],
    ["nome vazio", { displayName: "  " }],
    ["senha em texto puro", { passwordKey: "minhasenha" }],
  ])("recusa %s", async (_name, overrides) => {
    const response = await new Device(app).call("POST", "/auth/signup", {
      username: "valido",
      displayName: "Válido",
      passwordKey: key(),
      ...overrides,
    });
    expect(response.status).toBe(422);
  });

  it("entra com usuário e senha em outro aparelho", async () => {
    const celular = new Device(app);
    await celular.signup("pai", "Pai");
    const computador = new Device(app);
    const response = await computador.call("POST", "/auth/login", { username: "PAI", passwordKey: celular.passwordKey });
    expect(response.status).toBe(200);
    expect(((await response.json()) as MeResponse).user.username).toBe("pai");
  });

  it("a mesma mensagem para usuário inexistente e senha errada", async () => {
    await new Device(app).signup("pai", "Pai");
    const errada = await new Device(app).call("POST", "/auth/login", { username: "pai", passwordKey: key() });
    const inexistente = await new Device(app).call("POST", "/auth/login", { username: "ninguem", passwordKey: key() });
    expect(errada.status).toBe(401);
    expect(inexistente.status).toBe(401);
    expect(await errada.json()).toEqual(await inexistente.json());
  });

  it("bloqueia depois de 5 senhas erradas, mesmo com a senha certa", async () => {
    const pai = new Device(app);
    await pai.signup("pai", "Pai");
    const intruso = new Device(app);
    for (let i = 0; i < 4; i++) {
      expect((await intruso.call("POST", "/auth/login", { username: "pai", passwordKey: key() })).status).toBe(401);
    }
    expect((await intruso.call("POST", "/auth/login", { username: "pai", passwordKey: key() })).status).toBe(429);
    const certa = await new Device(app).call("POST", "/auth/login", { username: "pai", passwordKey: pai.passwordKey });
    expect(certa.status).toBe(429);
  });

  it("acertar a senha zera as tentativas erradas", async () => {
    const pai = new Device(app);
    await pai.signup("pai", "Pai");
    for (let i = 0; i < 4; i++) await new Device(app).call("POST", "/auth/login", { username: "pai", passwordKey: key() });
    expect((await new Device(app).call("POST", "/auth/login", { username: "pai", passwordKey: pai.passwordKey })).status).toBe(200);
    for (let i = 0; i < 4; i++) {
      expect((await new Device(app).call("POST", "/auth/login", { username: "pai", passwordKey: key() })).status).toBe(401);
    }
  });

  it("sair encerra a sessão", async () => {
    const pai = new Device(app);
    await pai.signup("pai", "Pai");
    const antigo = pai.cookie;
    expect((await pai.call("POST", "/auth/logout")).status).toBe(204);
    const reuse = await app.request("/api/auth/me", { headers: { cookie: antigo } });
    expect(reuse.status).toBe(401);
  });

  it("trocar a senha desconecta os outros aparelhos e vale no próximo login", async () => {
    const celular = new Device(app);
    await celular.signup("pai", "Pai");
    const tablet = new Device(app);
    await tablet.call("POST", "/auth/login", { username: "pai", passwordKey: celular.passwordKey });

    const nova = key();
    expect((await celular.call("PUT", "/auth/password", { currentKey: key(), newKey: nova })).status).toBe(403);
    expect((await celular.call("PUT", "/auth/password", { currentKey: celular.passwordKey, newKey: nova })).status).toBe(204);

    expect((await celular.call("GET", "/auth/me")).status).toBe(200);
    expect((await tablet.call("GET", "/auth/me")).status).toBe(401);
    expect((await new Device(app).call("POST", "/auth/login", { username: "pai", passwordKey: celular.passwordKey })).status).toBe(401);
    expect((await new Device(app).call("POST", "/auth/login", { username: "pai", passwordKey: nova })).status).toBe(200);
  });

  it("guarda senha e sessão só como hash", async () => {
    const pai = new Device(app);
    await pai.signup("pai", "Pai");
    const users = JSON.stringify(await db.prepare("SELECT * FROM users").all());
    expect(users).not.toContain(pai.passwordKey);
    const sessions = JSON.stringify(await db.prepare("SELECT * FROM sessions").all());
    expect(sessions).not.toContain(pai.cookies.get("lista_conta"));
  });

  it("cookie httpOnly, SameSite Strict e Secure em HTTPS", async () => {
    const response = await app.request("/api/auth/signup", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-proto": "https" },
      body: JSON.stringify({ username: "pai", displayName: "Pai", passwordKey: key() }),
    });
    const cookie = response.headers.get("set-cookie") ?? "";
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Strict");
    expect(cookie).toContain("Secure");
  });

  it("recusa cookie forjado", async () => {
    const response = await app.request("/api/auth/me", { headers: { cookie: `lista_conta=${"a".repeat(64)}` } });
    expect(response.status).toBe(401);
  });
});

describe("listas", () => {
  let renan: Device;
  let pai: Device;
  let casa: ListSummary;

  beforeEach(async () => {
    renan = new Device(app);
    pai = new Device(app);
    await renan.signup("renan", "Renan");
    await pai.signup("pai", "Pai");
    casa = await renan.createList("Casa");
  });

  it("quem cria vira administrador e a lista aparece no /me", async () => {
    expect(casa.role).toBe("admin");
    const me = (await (await renan.call("GET", "/auth/me")).json()) as MeResponse;
    expect(me.lists).toEqual([casa]);
  });

  it("mantém a ordem mesmo com tudo no mesmo milissegundo", async () => {
    const realNow = Date.prototype.toISOString;
    Date.prototype.toISOString = () => "2026-11-07T12:00:00.000Z";
    try {
      const a = await pai.createList("Primeira");
      const b = await pai.createList("Segunda");
      const c = await pai.createList("Terceira");
      await pai.call("POST", `/lists/${a.id}/members`, { username: "renan" });
      for (let i = 0; i < 5; i++) {
        const me = (await (await pai.call("GET", "/auth/me")).json()) as MeResponse;
        expect(me.lists.map((l) => l.id)).toEqual([a.id, b.id, c.id]);
        const members = (await (await pai.call("GET", `/lists/${a.id}/members`)).json()) as ListMember[];
        expect(members.map((m) => m.role)).toEqual(["admin", "member"]);
      }
    } finally {
      Date.prototype.toISOString = realNow;
    }
  });

  it("uma pessoa pode ter várias listas, cada uma com dados próprios", async () => {
    const pousada = await pai.createList("Pousada");
    const casaDoPai = await pai.createList("Casa do pai");
    await pai.call("PUT", `/lists/${pousada.id}/items`, { items: [item({ text: "Lençol" })] });
    const me = (await (await pai.call("GET", "/auth/me")).json()) as MeResponse;
    expect(me.lists.map((l) => l.name)).toEqual(["Pousada", "Casa do pai"]);
    expect((await pai.snapshot(pousada.id)).items.map((i) => i.text)).toEqual(["Lençol"]);
    expect((await pai.snapshot(casaDoPai.id)).items).toEqual([]);
  });

  describe("quem não participa", () => {
    it.each([
      ["GET", ""],
      ["PATCH", ""],
      ["DELETE", ""],
      ["GET", "/members"],
      ["POST", "/members"],
      ["PUT", "/items"],
      ["POST", "/items/delete"],
      ["POST", "/categories"],
      ["POST", "/purchases"],
      ["GET", "/events"],
    ])("%s /lists/:id%s responde que a lista não existe", async (method, path) => {
      const response = await pai.call(method, `/lists/${casa.id}${path}`, method === "GET" || method === "DELETE" ? undefined : {});
      expect(response.status).toBe(404);
      expect(((await response.json()) as { code: string }).code).toBe("list_access");
    });

    it("não altera item de outra lista usando o mesmo id", async () => {
      const original = item({ text: "Original" });
      await renan.call("PUT", `/lists/${casa.id}/items`, { items: [original] });
      const pousada = await pai.createList("Pousada");
      await pai.call("PUT", `/lists/${pousada.id}/items`, { items: [{ ...original, text: "Outro" }] });
      expect((await renan.snapshot(casa.id)).items[0].text).toBe("Original");
    });

    it("sem login, nada funciona", async () => {
      for (const path of ["/lists", `/lists/${casa.id}`]) {
        expect((await new Device(app).call("GET", path)).status).toBe(401);
      }
      expect((await new Device(app).call("POST", "/lists", { name: "X" })).status).toBe(401);
    });
  });

  describe("participantes", () => {
    it("o administrador adiciona pelo nome de usuário e a lista aparece para a pessoa", async () => {
      const response = await renan.call("POST", `/lists/${casa.id}/members`, { username: "PAI" });
      expect(response.status).toBe(201);
      const me = (await (await pai.call("GET", "/auth/me")).json()) as MeResponse;
      expect(me.lists).toEqual([{ id: casa.id, name: "Casa", role: "member" }]);
      await renan.call("PUT", `/lists/${casa.id}/items`, { items: [item({ text: "Café" })] });
      expect((await pai.snapshot(casa.id)).items.map((i) => i.text)).toEqual(["Café"]);
    });

    it("usuário que não existe ou que já participa", async () => {
      expect((await renan.call("POST", `/lists/${casa.id}/members`, { username: "fantasma" })).status).toBe(404);
      await renan.call("POST", `/lists/${casa.id}/members`, { username: "pai" });
      expect((await renan.call("POST", `/lists/${casa.id}/members`, { username: "pai" })).status).toBe(409);
    });

    it("lista os participantes com o papel de cada um", async () => {
      await renan.call("POST", `/lists/${casa.id}/members`, { username: "pai" });
      const members = (await (await pai.call("GET", `/lists/${casa.id}/members`)).json()) as ListMember[];
      expect(members.map((m) => [m.username, m.role])).toEqual([
        ["renan", "admin"],
        ["pai", "member"],
      ]);
    });

    it("membro comum não adiciona, não remove, não renomeia e não exclui", async () => {
      await renan.call("POST", `/lists/${casa.id}/members`, { username: "pai" });
      const tio = new Device(app);
      await tio.signup("tio", "Tio");
      expect((await pai.call("POST", `/lists/${casa.id}/members`, { username: "tio" })).status).toBe(403);
      expect((await pai.call("DELETE", `/lists/${casa.id}/members/${renan.me?.user.id}`)).status).toBe(403);
      expect((await pai.call("PATCH", `/lists/${casa.id}`, { name: "Minha" })).status).toBe(403);
      expect((await pai.call("DELETE", `/lists/${casa.id}`)).status).toBe(403);
    });

    it("removido perde o acesso na hora e é desconectado", async () => {
      await renan.call("POST", `/lists/${casa.id}/members`, { username: "pai" });
      const paiId = pai.me?.user.id;
      expect((await renan.call("DELETE", `/lists/${casa.id}/members/${paiId}`)).status).toBe(204);
      expect((await pai.call("GET", `/lists/${casa.id}`)).status).toBe(404);
      expect(notifier.disconnects).toEqual([`${casa.id}/${paiId}`]);
    });

    it("membro pode sair; administrador não", async () => {
      await renan.call("POST", `/lists/${casa.id}/members`, { username: "pai" });
      expect((await pai.call("POST", `/lists/${casa.id}/leave`)).status).toBe(204);
      expect((await pai.call("GET", `/lists/${casa.id}`)).status).toBe(404);
      expect((await renan.call("POST", `/lists/${casa.id}/leave`)).status).toBe(400);
    });

    it("administrador não remove a si mesmo", async () => {
      expect((await renan.call("DELETE", `/lists/${casa.id}/members/${renan.me?.user.id}`)).status).toBe(400);
    });
  });

  it("renomear e excluir a lista", async () => {
    const renamed = await renan.call("PATCH", `/lists/${casa.id}`, { name: "Casa da praia" });
    expect(((await renamed.json()) as ListSummary).name).toBe("Casa da praia");

    await renan.call("POST", `/lists/${casa.id}/members`, { username: "pai" });
    await renan.call("PUT", `/lists/${casa.id}/items`, { items: [item()] });
    expect((await renan.call("DELETE", `/lists/${casa.id}`)).status).toBe(204);
    expect((await renan.call("GET", `/lists/${casa.id}`)).status).toBe(404);
    const me = (await (await pai.call("GET", "/auth/me")).json()) as MeResponse;
    expect(me.lists).toEqual([]);
    const leftovers = await db.prepare("SELECT count(*) AS n FROM items").first<{ n: number }>();
    expect(leftovers?.n).toBe(0);
  });

  describe("itens e compras", () => {
    const purchase = (overrides: Partial<Purchase> & Record<string, unknown> = {}) => ({
      id: randomUUID(),
      amountCents: 15290,
      method: "credito",
      installments: 3,
      itemCount: 1,
      memberName: "Quem mandou",
      createdAt: new Date().toISOString(),
      items: [],
      ...overrides,
    });

    beforeEach(async () => {
      await renan.call("POST", `/lists/${casa.id}/members`, { username: "pai" });
    });

    it("reenviar não duplica", async () => {
      const novo = item();
      await renan.call("PUT", `/lists/${casa.id}/items`, { items: [novo] });
      await renan.call("PUT", `/lists/${casa.id}/items`, { items: [novo] });
      expect((await renan.snapshot(casa.id)).items).toHaveLength(1);
    });

    it.each([
      ["texto vazio", { text: "   " }],
      ["quantidade zero", { quantity: 0 }],
      ["id inválido", { id: "1 OR 1=1" }],
    ])("recusa item com %s", async (_name, overrides) => {
      const response = await renan.call("PUT", `/lists/${casa.id}/items`, { items: [item(overrides)] });
      expect(response.status).toBe(422);
    });

    it("finaliza a compra registrando quem é da conta, não o que o aparelho mandou", async () => {
      const antigo = item({ text: "Arroz" });
      await renan.call("PUT", `/lists/${casa.id}/items`, { items: [antigo] });
      const compra = purchase({ items: [{ text: "Arroz", quantity: 1, category: "Outros", done: true }] });
      expect((await pai.call("POST", `/lists/${casa.id}/purchases`, { purchase: compra, itemIds: [antigo.id] })).status).toBe(204);
      const snap = await renan.snapshot(casa.id);
      expect(snap.items).toEqual([]);
      expect(snap.purchases.map((p) => [p.id, p.memberName, p.items.length])).toEqual([[compra.id, "Pai", 1]]);
    });

    it("gastos ficam separados por lista", async () => {
      const pousada = await pai.createList("Pousada");
      await pai.call("POST", `/lists/${pousada.id}/purchases`, { purchase: purchase(), itemIds: [] });
      expect((await pai.snapshot(pousada.id)).purchases).toHaveLength(1);
      expect((await renan.snapshot(casa.id)).purchases).toEqual([]);
    });

    it("corrige, exclui e desfaz", async () => {
      const compra = purchase();
      await renan.call("POST", `/lists/${casa.id}/purchases`, { purchase: compra, itemIds: [] });
      expect((await pai.call("PUT", `/lists/${casa.id}/purchases/${compra.id}`, { amountCents: 100, method: "pix", installments: 1 })).status).toBe(204);
      expect((await renan.call("DELETE", `/lists/${casa.id}/purchases/${compra.id}`)).status).toBe(204);
      expect((await renan.snapshot(casa.id)).purchases).toEqual([]);
      expect((await renan.call("POST", `/lists/${casa.id}/purchases/${compra.id}/restore`)).status).toBe(204);
      const [saved] = (await renan.snapshot(casa.id)).purchases;
      expect([saved.amountCents, saved.method, saved.memberName]).toEqual([100, "pix", "Renan"]);
    });

    it("recusa PIX parcelado", async () => {
      const response = await renan.call("POST", `/lists/${casa.id}/purchases`, { purchase: purchase({ method: "pix", installments: 2 }), itemIds: [] });
      expect(response.status).toBe(422);
    });

    it("avisa em tempo real só a lista que mudou", async () => {
      const pousada = await pai.createList("Pousada");
      notifier.broadcasts = [];
      await renan.call("PUT", `/lists/${casa.id}/items`, { items: [item()] });
      await pai.call("POST", `/lists/${pousada.id}/categories`, { name: "Quartos" });
      expect(notifier.broadcasts).toEqual([casa.id, pousada.id]);
    });

    it("abre o canal em tempo real só com WebSocket", async () => {
      expect((await pai.call("GET", `/lists/${casa.id}/events`)).status).toBe(426);
      const response = await pai.call("GET", `/lists/${casa.id}/events`, undefined, { upgrade: "websocket" });
      expect(await response.text()).toBe("conectado");
    });
  });
});

describe("administrador geral", () => {
  let renan: Device;
  let pai: Device;
  let pousada: ListSummary;

  beforeEach(async () => {
    renan = new Device(app);
    pai = new Device(app);
    await renan.signup("renan", "Renan");
    await pai.signup("pai", "Pai");
    await renan.createList("Casa");
    pousada = await pai.createList("Pousada");
    await db.prepare("UPDATE users SET is_superadmin = 1 WHERE username = 'renan'").run();
  });

  it("quem não é administrador geral não acessa o painel", async () => {
    expect((await pai.call("GET", "/admin/overview")).status).toBe(403);
    expect((await pai.call("PUT", `/admin/users/${renan.me?.user.id}/password`, { passwordKey: key() })).status).toBe(403);
    expect((await new Device(app).call("GET", "/admin/overview")).status).toBe(401);
  });

  it("ninguém se torna administrador geral pela API", async () => {
    const espertinho = new Device(app);
    const response = await espertinho.call("POST", "/auth/signup", {
      username: "esperto",
      displayName: "Esperto",
      passwordKey: espertinho.passwordKey,
      isSuperAdmin: true,
      is_superadmin: 1,
    });
    expect(response.status).toBe(201);
    expect((await espertinho.call("GET", "/admin/overview")).status).toBe(403);
  });

  it("vê todas as contas e listas, com participantes", async () => {
    const me = (await (await renan.call("GET", "/auth/me")).json()) as MeResponse;
    expect(me.user.isSuperAdmin).toBe(true);
    expect(me.lists.map((l) => [l.name, l.role])).toEqual([
      ["Casa", "admin"],
      ["Pousada", "admin"],
    ]);
    const overview = (await (await renan.call("GET", "/admin/overview")).json()) as {
      users: { username: string; isSuperAdmin: boolean }[];
      lists: { name: string; members: { displayName: string }[] }[];
    };
    expect(overview.users.map((u) => [u.username, u.isSuperAdmin])).toEqual([
      ["renan", true],
      ["pai", false],
    ]);
    expect(overview.lists.map((l) => [l.name, l.members.map((m) => m.displayName)])).toEqual([
      ["Casa", ["Renan"]],
      ["Pousada", ["Pai"]],
    ]);
    // Nenhuma senha ou hash sai pelo painel.
    expect(JSON.stringify(overview)).not.toMatch(/password|hash|salt/i);
  });

  it("abre e edita uma lista em que não participa", async () => {
    expect((await renan.call("PUT", `/lists/${pousada.id}/items`, { items: [item({ text: "Sabonete" })] })).status).toBe(204);
    expect((await pai.snapshot(pousada.id)).items.map((i) => i.text)).toEqual(["Sabonete"]);
  });

  it("lista que não existe continua inexistente, mesmo para ele", async () => {
    expect((await renan.call("GET", `/lists/${randomUUID()}`)).status).toBe(404);
  });

  it("redefine a senha de alguém: destrava, desconecta e a senha antiga para de valer", async () => {
    for (let i = 0; i < 5; i++) await new Device(app).call("POST", "/auth/login", { username: "pai", passwordKey: key() });
    const nova = key();
    expect((await renan.call("PUT", `/admin/users/${pai.me?.user.id}/password`, { passwordKey: nova })).status).toBe(204);
    expect((await pai.call("GET", "/auth/me")).status).toBe(401);
    expect((await new Device(app).call("POST", "/auth/login", { username: "pai", passwordKey: pai.passwordKey })).status).toBe(401);
    expect((await new Device(app).call("POST", "/auth/login", { username: "pai", passwordKey: nova })).status).toBe(200);
  });

  it("desconecta todos os aparelhos de alguém", async () => {
    expect((await renan.call("POST", `/admin/users/${pai.me?.user.id}/logout`)).status).toBe(204);
    expect((await pai.call("GET", "/auth/me")).status).toBe(401);
  });

  it("conta inexistente", async () => {
    expect((await renan.call("PUT", `/admin/users/${randomUUID()}/password`, { passwordKey: key() })).status).toBe(404);
  });
});

describe("aparelhos da versão anterior", () => {
  const legacyToken = "b".repeat(64);
  let listId: string;

  beforeEach(async () => {
    const now = new Date().toISOString();
    listId = randomUUID();
    await db.batch([
      db.prepare("INSERT INTO families (id, name, invite_hash, created_at) VALUES ('f1', 'Família', 'h', ?)").bind(now),
      db.prepare("INSERT INTO lists (id, family_id, name, created_at) VALUES (?, 'f1', 'Casa', ?)").bind(listId, now),
      db
        .prepare(
          "INSERT INTO members (id, family_id, name, role, session_hash, joined_at, last_seen_at) VALUES ('m1', 'f1', 'Renan', 'admin', ?, ?, ?)",
        )
        .bind(await hashToken(legacyToken), now, now),
      db
        .prepare("INSERT INTO items (list_id, id, text, quantity, done, category, created_at) VALUES (?, ?, 'Café', 1, 0, 'Outros', ?)")
        .bind(listId, randomUUID(), now),
    ]);
  });

  it("o /me reconhece o aparelho antigo pelo nome", async () => {
    const device = new Device(app);
    device.cookies.set("lista_sessao", legacyToken);
    const response = await device.call("GET", "/auth/me");
    expect(await response.json()).toEqual({ legacy: { name: "Renan" } });
  });

  it("cria a conta levando o acesso de administrador à lista, com os itens", async () => {
    const device = new Device(app);
    device.cookies.set("lista_sessao", legacyToken);
    const response = await device.call("POST", "/auth/claim", { username: "renan", displayName: "Renan", passwordKey: device.passwordKey });
    expect(response.status).toBe(201);
    const me = (await response.json()) as MeResponse;
    expect(me.lists).toEqual([{ id: listId, name: "Casa", role: "admin" }]);
    expect((await device.snapshot(listId)).items.map((i) => i.text)).toEqual(["Café"]);

    // O cookie antigo deixa de valer.
    expect(device.cookies.has("lista_sessao")).toBe(false);
    const reuse = new Device(app);
    reuse.cookies.set("lista_sessao", legacyToken);
    expect((await reuse.call("GET", "/auth/me")).status).toBe(401);
  });

  it("sem o cookie antigo, não há o que transferir", async () => {
    const response = await new Device(app).call("POST", "/auth/claim", { username: "renan", displayName: "Renan", passwordKey: key() });
    expect(response.status).toBe(404);
  });

  it("usuário já usado mantém o aparelho antigo válido para tentar de novo", async () => {
    await new Device(app).signup("renan", "Outro Renan");
    const device = new Device(app);
    device.cookies.set("lista_sessao", legacyToken);
    expect((await device.call("POST", "/auth/claim", { username: "renan", displayName: "Renan", passwordKey: key() })).status).toBe(409);
    expect(await (await device.call("GET", "/auth/me")).json()).toEqual({ legacy: { name: "Renan" } });
  });
});

describe("cupom fiscal", () => {
  const KEY = "25261107309087000122651110005414179346777270";
  let renan: Device;
  let estranho: Device;
  let casa: ListSummary;
  let reads: string[];
  let answer: unknown;

  const compra = () => ({
    id: randomUUID(),
    amountCents: 2000,
    method: "debito",
    installments: 1,
    itemCount: 2,
    memberName: "",
    createdAt: new Date().toISOString(),
    items: [
      { text: "Amendoim", quantity: 1, category: "Mercearia", done: true },
      { text: "Café", quantity: 1, category: "Mercearia", done: false },
    ],
  });

  const cupom = (overrides: Record<string, unknown> = {}) => ({
    accessKey: KEY,
    storeName: "RC Comercio de Alimentos LTDA",
    cnpj: "07309087000122",
    issuedOn: "2026-11-04",
    totalCents: 1738,
    source: "foto",
    readAt: new Date().toISOString(),
    items: [
      { code: "7896058599848", description: "AMENDOIM PETTIZ", quantity: 2, unit: "UN", unitCents: 869, totalCents: 1738, listIndex: 0 },
      { code: "", description: "SACOLA", quantity: 1, unit: "UN", unitCents: 0, totalCents: 0, listIndex: 7 },
    ],
    ...overrides,
  });

  beforeEach(async () => {
    reads = [];
    answer = {
      loja: "RC Comercio",
        cnpj: "07.309.087/0001-22",
        data: "04/11/2026",
        itens: [
          { codigo: "7896058599848", descricao: "AMENDOIM PETTIZ", quantidade: 1, unidade: "un", valorUnitario: "8,69", valorTotal: 8.69 },
          { codigo: "7896058599848", descricao: "AMENDOIM PETTIZ", quantidade: 1, unidade: "UN", valorUnitario: 8.69, valorTotal: 8.69 },
          { descricao: "", valorTotal: 1 },
        ],
        total: 17.38,
    };
    app = createApp(db, notifier, {
      read: async (image) => {
        reads.push(image);
        return answer;
      },
    });
    renan = new Device(app);
    estranho = new Device(app);
    await renan.signup("renan", "Renan");
    await estranho.signup("estranho", "Estranho");
    casa = await renan.createList("Casa");
  });

  it("lê a foto e devolve os produtos normalizados, sem gravar nada", async () => {
    const image = "A".repeat(200);
    const response = await renan.call("POST", `/lists/${casa.id}/receipts/read`, { image });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      storeName: "RC Comercio",
      cnpj: "07309087000122",
      issuedOn: "2026-11-04",
      totalCents: 1738,
      items: [{ code: "7896058599848", description: "AMENDOIM PETTIZ", quantity: 2, unit: "UN", unitCents: 869, totalCents: 1738 }],
    });
    expect(reads).toEqual([image]);
  });

  it("aceita foto maior que o limite comum de envio", async () => {
    const response = await renan.call("POST", `/lists/${casa.id}/receipts/read`, { image: "A".repeat(2_000_000) });
    expect(response.status).toBe(200);
  });

  it("quem não participa da lista não lê nem grava cupom", async () => {
    expect((await estranho.call("POST", `/lists/${casa.id}/receipts/read`, { image: "A".repeat(200) })).status).toBe(404);
    expect(reads).toEqual([]);
  });

  it("foto sem produtos e limite diário viram mensagens claras", async () => {
    answer = null;
    const empty = await renan.call("POST", `/lists/${casa.id}/receipts/read`, { image: "A".repeat(200) });
    expect(empty.status).toBe(422);
    expect(((await empty.json()) as { error: string }).error).toMatch(/Não encontrei produtos/);
    for (let i = 0; i < 29; i++) await renan.call("POST", `/lists/${casa.id}/receipts/read`, { image: "A".repeat(200) });
    const limited = await renan.call("POST", `/lists/${casa.id}/receipts/read`, { image: "A".repeat(200) });
    expect(limited.status).toBe(429);
    expect(reads).toHaveLength(30);
  });

  it("sem IA configurada responde 503", async () => {
    const semIa = new Device(createApp(db, notifier));
    semIa.cookies = renan.cookies;
    expect((await semIa.call("POST", `/lists/${casa.id}/receipts/read`, { image: "A".repeat(200) })).status).toBe(503);
  });

  it("liga o cupom à compra, aparece no snapshot e some ao remover", async () => {
    const c = compra();
    await renan.call("POST", `/lists/${casa.id}/purchases`, { purchase: c, itemIds: [] });
    notifier.broadcasts = [];
    expect((await renan.call("PUT", `/lists/${casa.id}/purchases/${c.id}/receipt`, cupom())).status).toBe(204);
    // Reenviar (fila offline) dá o mesmo resultado.
    expect((await renan.call("PUT", `/lists/${casa.id}/purchases/${c.id}/receipt`, cupom())).status).toBe(204);
    expect(notifier.broadcasts).toEqual([casa.id, casa.id]);

    const [saved] = (await renan.snapshot(casa.id)).purchases;
    expect(saved.receipt).toMatchObject({ accessKey: KEY, storeName: "RC Comercio de Alimentos LTDA", totalCents: 1738 });
    // A ligação para um item que não existe na compra vira "fora da lista".
    expect(saved.receipt?.items.map((i) => [i.description, i.listIndex])).toEqual([
      ["AMENDOIM PETTIZ", 0],
      ["SACOLA", null],
    ]);

    expect((await renan.call("DELETE", `/lists/${casa.id}/purchases/${c.id}/receipt`)).status).toBe(204);
    expect((await renan.snapshot(casa.id)).purchases[0].receipt).toBeNull();
  });

  it("o mesmo cupom não entra em duas compras", async () => {
    const a = compra();
    const b = compra();
    await renan.call("POST", `/lists/${casa.id}/purchases`, { purchase: a, itemIds: [] });
    await renan.call("POST", `/lists/${casa.id}/purchases`, { purchase: b, itemIds: [] });
    await renan.call("PUT", `/lists/${casa.id}/purchases/${a.id}/receipt`, cupom());
    const response = await renan.call("PUT", `/lists/${casa.id}/purchases/${b.id}/receipt`, cupom());
    expect(response.status).toBe(409);
    expect(((await response.json()) as { error: string }).error).toMatch(/já está ligado à compra de/);
    // Sem chave (só foto, QR ilegível) pode.
    expect((await renan.call("PUT", `/lists/${casa.id}/purchases/${b.id}/receipt`, cupom({ accessKey: null }))).status).toBe(204);
  });

  it("recusa cupom de compra que não existe ou com dados inválidos", async () => {
    expect((await renan.call("PUT", `/lists/${casa.id}/purchases/${randomUUID()}/receipt`, cupom())).status).toBe(404);
    const c = compra();
    await renan.call("POST", `/lists/${casa.id}/purchases`, { purchase: c, itemIds: [] });
    expect((await renan.call("PUT", `/lists/${casa.id}/purchases/${c.id}/receipt`, cupom({ accessKey: "123" }))).status).toBe(422);
  });

  it("excluir a lista apaga os cupons junto", async () => {
    const c = compra();
    await renan.call("POST", `/lists/${casa.id}/purchases`, { purchase: c, itemIds: [] });
    await renan.call("PUT", `/lists/${casa.id}/purchases/${c.id}/receipt`, cupom());
    expect((await renan.call("DELETE", `/lists/${casa.id}`)).status).toBe(204);
    const left = await db.prepare("SELECT COUNT(*) AS n FROM receipt_items").first<{ n: number }>();
    expect(left?.n).toBe(0);
  });
});
