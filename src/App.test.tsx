import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { App } from "./App";
import { applyOp } from "./data/applyOp";
import type { ListBackend } from "./data/backend";
import { SyncedList } from "./data/syncedList";
import type { Op, SessionInfo, Snapshot } from "./domain/types";

class MemoryBackend implements ListBackend {
  snapshot: Snapshot = { items: [], customCategories: [] };
  async load() {
    return this.snapshot;
  }
  async apply(op: Op) {
    this.snapshot = applyOp(this.snapshot, op);
  }
  subscribe() {
    return () => {};
  }
}

const session: SessionInfo = {
  memberId: "m1",
  name: "Renan",
  role: "admin",
  familyId: "f1",
  familyName: "Família Benitez",
};

type User = ReturnType<typeof userEvent.setup>;

function renderApp() {
  render(
    <App
      list={new SyncedList(new MemoryBackend(), "teste")}
      session={session}
      onRejoined={() => {}}
    />,
  );
  return userEvent.setup();
}

async function openAddSheet(user: User) {
  await user.click(screen.getByRole("button", { name: "Adicionar" }));
  return screen.findByRole("dialog", { name: "Novo item" });
}

/** Adiciona pelo painel e fecha, como faria quem usa o app. */
async function addItems(user: User, ...texts: string[]) {
  const dialog = await openAddSheet(user);
  for (const text of texts) {
    await user.type(within(dialog).getByLabelText("O que precisa comprar?"), `${text}{Enter}`);
  }
  await user.click(within(dialog).getByRole("button", { name: "Fechar" }));
}

describe("App", () => {
  beforeEach(() => localStorage.clear());
  afterEach(cleanup);

  it("adiciona vários itens sem fechar o painel", async () => {
    const user = renderApp();
    expect(await screen.findByText("Oi, Renan! Sua lista está vazia.")).toBeTruthy();

    const dialog = await openAddSheet(user);
    await user.type(within(dialog).getByLabelText("O que precisa comprar?"), "Arroz{Enter}");
    expect(await within(dialog).findByText("Arroz entrou na lista.")).toBeTruthy();
    await user.type(within(dialog).getByLabelText("O que precisa comprar?"), "Feijão{Enter}");
    expect(await within(dialog).findByText("Feijão entrou na lista.")).toBeTruthy();
    await user.click(within(dialog).getByRole("button", { name: "Fechar" }));

    expect(screen.getByRole("heading", { name: /^Outros/ })).toBeTruthy();
    expect(screen.getByText("Oi, Renan! Faltam 2 itens.")).toBeTruthy();
  });

  it("lê a quantidade digitada e permite ajustar", async () => {
    const user = renderApp();
    await addItems(user, "2 frangos");

    expect(screen.getByText("Frangos")).toBeTruthy();
    expect(screen.getByText("2×")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Editar Frangos" }));
    await user.click(screen.getByRole("button", { name: "Aumentar quantidade de Frangos" }));
    expect(await screen.findByText("3×")).toBeTruthy();
    expect(screen.getByText("Oi, Renan! Falta 1 item.")).toBeTruthy();
  });

  it("marca, limpa o carrinho com confirmação e desfaz", async () => {
    const user = renderApp();
    await addItems(user, "Arroz");

    await user.click(screen.getByRole("button", { name: "Marcar Arroz como comprado" }));
    expect(await screen.findByText("Oi, Renan! Tudo comprado.")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "No carrinho · 1" })).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Limpar o carrinho" }));
    const confirm = await screen.findByRole("dialog", { name: "Limpar o carrinho?" });
    await user.click(within(confirm).getByRole("button", { name: "Limpar" }));
    expect(await screen.findByText("Oi, Renan! Sua lista está vazia.")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Desfazer" }));
    expect(await screen.findByRole("button", { name: "Tirar Arroz do carrinho" })).toBeTruthy();
  });

  it("cancelar a confirmação não apaga nada", async () => {
    const user = renderApp();
    await addItems(user, "Sal");
    await user.click(screen.getByRole("button", { name: "Marcar Sal como comprado" }));

    await user.click(screen.getByRole("button", { name: "Limpar o carrinho" }));
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.getByRole("button", { name: "Tirar Sal do carrinho" })).toBeTruthy();
  });

  it("muda a categoria sem marcar o item", async () => {
    const user = renderApp();
    await addItems(user, "Tomate");

    await user.click(screen.getByRole("button", { name: "Editar Tomate" }));
    const group = screen.getByRole("group", { name: "Categoria de Tomate" });
    await user.click(within(group).getByRole("radio", { name: "Hortifruti" }));
    await user.click(screen.getByRole("button", { name: "Fechar" }));

    expect(screen.getByRole("heading", { name: /^Hortifruti/ })).toBeTruthy();
    expect(screen.getByText("Oi, Renan! Falta 1 item.")).toBeTruthy();
  });

  it("tira o item da lista e desfaz", async () => {
    const user = renderApp();
    await addItems(user, "Sabão");

    await user.click(screen.getByRole("button", { name: "Editar Sabão" }));
    await user.click(screen.getByRole("button", { name: "Tirar da lista" }));
    expect(await screen.findByText("Sabão saiu da lista")).toBeTruthy();
    expect(screen.getByText("Oi, Renan! Sua lista está vazia.")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Desfazer" }));
    expect(await screen.findByRole("button", { name: "Editar Sabão" })).toBeTruthy();
  });

  it("cria categoria e já usa no próximo item", async () => {
    const user = renderApp();
    const dialog = await openAddSheet(user);

    await user.click(within(dialog).getByRole("button", { name: "Nova categoria" }));
    await user.type(within(dialog).getByLabelText("Nome da nova categoria"), "Pet{Enter}");
    expect((within(dialog).getByRole("radio", { name: "Pet" }) as HTMLInputElement).checked).toBe(true);

    await user.type(within(dialog).getByLabelText("O que precisa comprar?"), "Ração{Enter}");
    await user.click(within(dialog).getByRole("button", { name: "Fechar" }));
    expect(screen.getByRole("heading", { name: /^Pet/ })).toBeTruthy();
  });

  it("importa vários itens colados", async () => {
    const user = renderApp();
    const dialog = await openAddSheet(user);
    await user.click(within(dialog).getByRole("button", { name: "Colar vários itens de uma vez" }));

    const sheet = await screen.findByRole("dialog", { name: "Colar vários itens" });
    await user.type(within(sheet).getByLabelText("Itens"), "Bebidas{Enter}Suco{Enter}2 águas");
    await user.click(within(sheet).getByRole("button", { name: "Importar 2 itens" }));

    expect(await screen.findByText("2 itens importados")).toBeTruthy();
    expect(screen.getByRole("heading", { name: /^Bebidas/ })).toBeTruthy();
    expect(screen.getByText("Águas")).toBeTruthy();
  });

  it("Esc fecha o painel e devolve o foco ao botão", async () => {
    const user = renderApp();
    await openAddSheet(user);
    expect(document.activeElement).toBe(screen.getByLabelText("O que precisa comprar?"));

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Adicionar" }));
  });

  it("navega para a família pela barra inferior", async () => {
    const user = renderApp();
    await user.click(screen.getByRole("button", { name: "Família" }));

    expect(screen.getByRole("heading", { name: "Família Benitez" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Família" }).getAttribute("aria-current")).toBe("page");
  });
});
