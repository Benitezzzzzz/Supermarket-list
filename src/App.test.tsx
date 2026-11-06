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
  familyName: "Família",
};

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

async function addItem(user: ReturnType<typeof userEvent.setup>, text: string) {
  await user.type(screen.getByLabelText("O que precisa comprar?"), `${text}{Enter}`);
  await screen.findByText(text);
}

describe("App", () => {
  beforeEach(() => localStorage.clear());
  afterEach(cleanup);

  it("adiciona, marca e limpa comprados", async () => {
    const user = renderApp();
    await screen.findByText("Lista vazia");

    await addItem(user, "Arroz");
    expect(screen.getByText("1 item para comprar")).toBeTruthy();

    await user.click(screen.getByText("Arroz"));
    const bought = await screen.findByRole("heading", { name: "Já comprado" });
    expect(within(bought.parentElement!).getByText("Arroz")).toBeTruthy();
    expect(screen.getByText("Tudo comprado! ✅")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Limpar comprados" }));
    expect(await screen.findByText("Lista vazia")).toBeTruthy();
  });

  it("muda a categoria sem marcar o item", async () => {
    const user = renderApp();
    await addItem(user, "Tomate");

    await user.click(screen.getByRole("button", { name: "Editar Tomate" }));
    await user.selectOptions(screen.getByLabelText("Categoria de Tomate"), "Hortifruti");

    expect(await screen.findByRole("heading", { name: "Hortifruti" })).toBeTruthy();
    expect(screen.getByText("1 item para comprar")).toBeTruthy();
  });

  it("lê a quantidade digitada e permite ajustar", async () => {
    const user = renderApp();
    await user.type(screen.getByLabelText("O que precisa comprar?"), "2 frangos{Enter}");
    expect(await screen.findByText("Frangos")).toBeTruthy();
    expect(screen.getByText("2×")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Editar Frangos" }));
    await user.click(screen.getByRole("button", { name: "Aumentar quantidade de Frangos" }));
    expect(await screen.findByText("3×")).toBeTruthy();
    expect(screen.getByText("1 item para comprar")).toBeTruthy();
  });

  it("remove item sem marcar", async () => {
    const user = renderApp();
    await addItem(user, "Sal");

    await user.click(screen.getByRole("button", { name: "Remover Sal" }));
    expect(await screen.findByText("Lista vazia")).toBeTruthy();
  });

  it("cria categoria e já usa no próximo item", async () => {
    const user = renderApp();
    await screen.findByText("Lista vazia");

    await user.click(screen.getByRole("button", { name: "Criar nova categoria" }));
    await user.type(screen.getByLabelText("Nome da nova categoria"), "Pet{Enter}");
    await addItem(user, "Ração");

    expect(await screen.findByRole("heading", { name: "Pet" })).toBeTruthy();
  });

  it("importa vários itens", async () => {
    const user = renderApp();
    await screen.findByText("Lista vazia");

    await user.click(screen.getByRole("button", { name: "Importar lista" }));
    await user.type(screen.getByLabelText("Itens para importar"), "Bebidas{Enter}Suco{Enter}Água");
    await user.click(screen.getByRole("button", { name: "Importar" }));

    expect(await screen.findByText("2 itens para comprar")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Bebidas" })).toBeTruthy();
  });
});
