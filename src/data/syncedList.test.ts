import { beforeEach, describe, expect, it } from "vitest";
import { createItem } from "../domain/items";
import type { Op, Snapshot } from "../domain/types";
import { applyOp } from "./applyOp";
import { AccessRevokedError, type ListBackend, RejectedOpError } from "./backend";
import { SyncedList } from "./syncedList";

/** Servidor em memória; vários SyncedList podem compartilhar o mesmo. */
class FakeServer implements ListBackend {
  snapshot: Snapshot = { items: [], customCategories: [] };
  online = true;
  revoked = false;
  rejectNext = false;
  private listeners = new Set<() => void>();

  async load() {
    if (this.revoked) throw new AccessRevokedError("sem acesso");
    if (!this.online) throw new Error("offline");
    return this.snapshot;
  }

  async apply(op: Op) {
    if (!this.online) throw new Error("offline");
    if (this.rejectNext) {
      this.rejectNext = false;
      throw new RejectedOpError("recusado");
    }
    this.snapshot = applyOp(this.snapshot, op);
    for (const listener of this.listeners) listener();
  }

  subscribe(onChange: () => void) {
    this.listeners.add(onChange);
    return () => void this.listeners.delete(onChange);
  }
}

const texts = (list: SyncedList) => list.getState().items.map((item) => item.text);

describe("SyncedList", () => {
  let server: FakeServer;

  beforeEach(() => {
    localStorage.clear();
    server = new FakeServer();
  });

  it("mostra o item na hora, antes de o servidor responder", async () => {
    const list = new SyncedList(server, "a");
    list.addItems([createItem("Arroz", "Outros")]);

    expect(texts(list)).toEqual(["Arroz"]);
    await list.sync();
    expect(server.snapshot.items.map((i) => i.text)).toEqual(["Arroz"]);
    expect(list.getState().pendingCount).toBe(0);
  });

  it("não perde alterações feitas ao mesmo tempo em dois aparelhos", async () => {
    const pai = new SyncedList(server, "pai");
    const mae = new SyncedList(server, "mae");
    await Promise.all([pai.sync(), mae.sync()]);

    pai.addItems([createItem("Arroz", "Outros", new Date(1))]);
    mae.addItems([createItem("Feijão", "Outros", new Date(2))]);
    await Promise.all([pai.sync(), mae.sync()]);
    await Promise.all([pai.refresh(), mae.refresh()]);

    expect(texts(pai)).toEqual(["Arroz", "Feijão"]);
    expect(texts(mae)).toEqual(["Arroz", "Feijão"]);
  });

  it("guarda alterações offline e envia quando a conexão volta", async () => {
    const list = new SyncedList(server, "a");
    await list.sync();
    server.online = false;

    list.addItems([createItem("Arroz", "Outros")]);
    await list.sync();
    expect(list.getState().connection).toBe("offline");
    expect(list.getState().pendingCount).toBe(1);
    expect(texts(list)).toEqual(["Arroz"]);

    server.online = true;
    await list.sync();
    expect(list.getState().connection).toBe("online");
    expect(list.getState().pendingCount).toBe(0);
    expect(server.snapshot.items).toHaveLength(1);
  });

  it("mantém a fila offline mesmo se o app for fechado", async () => {
    server.online = false;
    const antes = new SyncedList(server, "a");
    antes.addItems([createItem("Arroz", "Outros")]);
    await antes.sync();

    server.online = true;
    const depois = new SyncedList(server, "a");
    expect(texts(depois)).toEqual(["Arroz"]);
    await depois.sync();
    expect(server.snapshot.items.map((i) => i.text)).toEqual(["Arroz"]);
  });

  it("alteração pendente continua visível quando chega versão do servidor", async () => {
    const outro = createItem("Feijão", "Outros", new Date(2));
    server.snapshot = { items: [outro], customCategories: [] };
    const list = new SyncedList(server, "a");
    await list.sync();

    server.online = false;
    list.updateItem(outro.id, { done: true });
    await list.sync();
    server.online = true;
    await list.refresh();

    expect(list.getState().items[0].done).toBe(true);
    expect(server.snapshot.items[0].done).toBe(false);
  });

  it("descarta alteração recusada sem travar as seguintes", async () => {
    const list = new SyncedList(server, "a");
    await list.sync();
    server.rejectNext = true;

    list.addItems([createItem("Recusado", "Outros", new Date(1))]);
    list.addItems([createItem("Aceito", "Outros", new Date(2))]);
    await list.sync();
    await list.refresh();

    expect(texts(list)).toEqual(["Aceito"]);
    expect(list.getState().rejected).toBe(true);
  });

  it("avisa quando perde o acesso e mantém a cópia local", async () => {
    const list = new SyncedList(server, "a");
    list.addItems([createItem("Arroz", "Outros")]);
    await list.sync();

    server.revoked = true;
    await list.refresh();

    expect(list.getState().accessRevoked).toBe(true);
    expect(texts(list)).toEqual(["Arroz"]);
  });

  it("recebe mudanças de outro aparelho pela assinatura", async () => {
    const pai = new SyncedList(server, "pai");
    const mae = new SyncedList(server, "mae");
    const stop = mae.start();
    await pai.sync();

    pai.addItems([createItem("Arroz", "Outros")]);
    await pai.sync();
    await new Promise((resolve) => setTimeout(resolve));

    expect(texts(mae)).toEqual(["Arroz"]);
    stop();
  });
});
