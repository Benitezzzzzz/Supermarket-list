import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import { applyOp } from "./data/applyOp";
import type { ListBackend } from "./data/backend";
import { SyncedList } from "./data/syncedList";
import { captureSharedText } from "./sharedText";
import type { ListSummary, Op, Snapshot, UserInfo } from "./domain/types";

const receiptMocks = vi.hoisted(() => ({
  qr: "https://www5.receita.pb.gov.br/atf/seg/SEGf_AcessarFuncao.jsp?cdFuncao=FIS_1410&?p=25261107309087000122651110005414179346777270|2|1|04|17.38||1|C1D1",
  reading: {
    storeName: "RC Comercio de Alimentos LTDA",
    cnpj: "07309087000122",
    issuedOn: "2026-11-04",
    totalCents: 2252,
    items: [
      { code: "7896058599848", description: "AMENDOIM PETTIZ CROC 120G", quantity: 2, unit: "UN", unitCents: 869, totalCents: 1738 },
      { code: "7896", description: "LTE UHT ITALAC INT 1L", quantity: 1, unit: "UN", unitCents: 499, totalCents: 499 },
      { code: "", description: "SACOLA PLASTICA", quantity: 1, unit: "UN", unitCents: 15, totalCents: 15 },
    ],
  },
  sent: [] as string[][],
}));

vi.mock("./data/receiptImage", () => ({
  preparePhoto: async () => ({ base64: "FOTO", qrText: receiptMocks.qr }),
  qrFromPhoto: async () => receiptMocks.qr,
  scanVideo: () => () => {},
}));
vi.mock("./data/receiptsApi", () => ({
  readReceiptPhoto: async (listId: string, base64: string) => {
    receiptMocks.sent.push([listId, base64]);
    return receiptMocks.reading;
  },
}));

class MemoryBackend implements ListBackend {
  snapshot: Snapshot = { items: [], customCategories: [], purchases: [] };
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

const user: UserInfo = { id: "u1", username: "renan", displayName: "Renan" };
const casa: ListSummary = { id: "l1", name: "Casa", role: "admin" };
const pousada: ListSummary = { id: "l2", name: "Pousada", role: "member" };
const calls: string[] = [];

type User = ReturnType<typeof userEvent.setup>;

function renderApp() {
  render(
    <App
      list={new SyncedList(new MemoryBackend(), "teste")}
      user={user}
      current={casa}
      lists={[casa, pousada]}
      onSwitchList={(id) => calls.push(`switch:${id}`)}
      onCreateList={async (name) => {
        calls.push(`create:${name}`);
      }}
      onListsChanged={() => calls.push("changed")}
      onLogout={() => calls.push("logout")}
      onSessionLost={() => calls.push("session-lost")}
      onListLost={() => calls.push("list-lost")}
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
  beforeEach(() => {
    localStorage.clear();
    calls.length = 0;
  });
  afterEach(cleanup);

  it("mostra a lista atual no topo e troca de lista", async () => {
    const user = renderApp();
    await user.click(screen.getByRole("button", { name: "Lista Casa. Trocar de lista" }));
    const sheet = await screen.findByRole("dialog", { name: "Suas listas" });
    expect((within(sheet).getByRole("radio", { name: /Casa/ }) as HTMLInputElement).checked).toBe(true);
    await user.click(within(sheet).getByRole("radio", { name: /Pousada/ }));
    expect(calls).toEqual(["switch:l2"]);
  });

  it("cria uma lista nova pelo seletor", async () => {
    const user = renderApp();
    await user.click(screen.getByRole("button", { name: "Lista Casa. Trocar de lista" }));
    await user.type(await screen.findByLabelText("Nova lista"), "Pousada da praia");
    await user.click(screen.getByRole("button", { name: "Criar" }));
    expect(calls).toEqual(["create:Pousada da praia"]);
  });

  it("só o administrador geral vê o botão de administração", async () => {
    const user = renderApp();
    await user.click(screen.getByRole("button", { name: "Sua conta" }));
    const sheet = await screen.findByRole("dialog", { name: "Sua conta" });
    expect(within(sheet).queryByRole("button", { name: "Administração geral" })).toBeNull();
  });

  it("abre a conta e sai", async () => {
    const user = renderApp();
    await user.click(screen.getByRole("button", { name: "Sua conta" }));
    const sheet = await screen.findByRole("dialog", { name: "Sua conta" });
    expect(within(sheet).getByText("Usuário: renan")).toBeTruthy();
    await user.click(within(sheet).getByRole("button", { name: "Sair da conta neste aparelho" }));
    expect(calls).toEqual(["logout"]);
  });

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

  it("marcar deixa o item na mesma categoria, só riscado", async () => {
    const user = renderApp();
    await addItems(user, "Arroz", "Feijão");

    await user.click(screen.getByRole("button", { name: "Marcar Arroz como comprado" }));
    const card = screen.getByRole("region", { name: "Outros" });
    const marcado = within(card).getByRole("button", { name: "Desmarcar Arroz" });
    expect(marcado.getAttribute("aria-pressed")).toBe("true");
    expect(marcado.closest("li")?.className).toContain("item--done");
    // Continua na mesma ordem: Arroz antes de Feijão.
    const ordem = within(card).getAllByRole("button", { name: /Arroz|Feijão/ }).map((b) => b.getAttribute("aria-label"));
    expect(ordem.filter((n) => !n?.startsWith("Editar"))).toEqual(["Desmarcar Arroz", "Marcar Feijão como comprado"]);
    expect(screen.queryByText(/No carrinho/)).toBeNull();
    expect(screen.getByText("Oi, Renan! Falta 1 item.")).toBeTruthy();

    await user.click(marcado);
    expect(screen.getByRole("button", { name: "Marcar Arroz como comprado" })).toBeTruthy();
  });

  it("a lixeira limpa só os riscados e desfaz", async () => {
    const user = renderApp();
    await addItems(user, "Arroz", "Feijão");
    await user.click(screen.getByRole("button", { name: "Marcar Arroz como comprado" }));

    await user.click(screen.getByRole("button", { name: "Limpar a lista" }));
    const sheet = await screen.findByRole("dialog", { name: "Limpar a lista?" });
    await user.click(within(sheet).getByRole("button", { name: "Limpar só o riscado (1)" }));
    expect(screen.queryByRole("button", { name: "Desmarcar Arroz" })).toBeNull();
    expect(screen.getByRole("button", { name: "Editar Feijão" })).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Desfazer" }));
    expect(await screen.findByRole("button", { name: "Desmarcar Arroz" })).toBeTruthy();
  });

  it("a lixeira limpa a lista toda e desfaz", async () => {
    const user = renderApp();
    expect(screen.queryByRole("button", { name: "Limpar a lista" })).toBeNull();
    await addItems(user, "Arroz", "Feijão");
    await user.click(screen.getByRole("button", { name: "Marcar Arroz como comprado" }));

    await user.click(screen.getByRole("button", { name: "Limpar a lista" }));
    await user.click(await screen.findByRole("button", { name: "Limpar a lista toda (2)" }));
    expect(await screen.findByText("Oi, Renan! Sua lista está vazia.")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Desfazer" }));
    expect(await screen.findByRole("button", { name: "Editar Feijão" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Desmarcar Arroz" })).toBeTruthy();
  });

  it("sem itens riscados, a lixeira só oferece limpar tudo", async () => {
    const user = renderApp();
    await addItems(user, "Arroz");
    await user.click(screen.getByRole("button", { name: "Limpar a lista" }));
    const sheet = await screen.findByRole("dialog", { name: "Limpar a lista?" });
    expect(within(sheet).queryByRole("button", { name: /riscad/ })).toBeNull();
    expect(within(sheet).getByRole("button", { name: "Limpar a lista toda (1)" })).toBeTruthy();
  });

  it("finaliza a compra no crédito parcelado e mostra em Gastos", async () => {
    const user = renderApp();
    await addItems(user, "Arroz", "Feijão");

    await user.click(screen.getByRole("button", { name: "Finalizar compra" }));
    const form = await screen.findByRole("dialog", { name: "Finalizar compra" });
    await user.click(within(form).getByRole("button", { name: "Continuar" }));
    expect(within(form).getByRole("alert").textContent).toMatch(/valor da compra/);

    await user.type(within(form).getByLabelText("Valor da compra"), "152,90");
    await user.click(within(form).getByRole("radio", { name: "Cartão de crédito" }));
    await user.click(within(form).getByRole("radio", { name: "Parcelado" }));
    await user.click(within(form).getByRole("button", { name: "Mais parcelas" }));
    expect(within(form).getByText(/3x de R\$\s50,97/)).toBeTruthy();
    await user.click(within(form).getByRole("button", { name: "Continuar" }));

    const confirm = await screen.findByRole("dialog", { name: "Finalizar lista?" });
    expect(within(confirm).getByText(/Os 2 itens saem da lista/)).toBeTruthy();
    await user.click(within(confirm).getByRole("button", { name: "Sim, finalizar" }));

    expect(await screen.findByText("Oi, Renan! Sua lista está vazia.")).toBeTruthy();
    expect(screen.getByText("Compra finalizada e guardada em Gastos")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Gastos" }));
    expect(screen.getByRole("heading", { name: "Gastos" })).toBeTruthy();
    expect(screen.getAllByText(/R\$\s152,90/).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/Crédito em 3x de R\$\s50,97/)).toBeTruthy();
    expect(screen.getByText("2 itens · por Renan")).toBeTruthy();
  });

  it("dizer Não na pergunta volta sem apagar nada", async () => {
    const user = renderApp();
    await addItems(user, "Sal");

    await user.click(screen.getByRole("button", { name: "Finalizar compra" }));
    await user.type(screen.getByLabelText("Valor da compra"), "10");
    await user.click(screen.getByRole("radio", { name: "PIX" }));
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    await user.click(await screen.findByRole("button", { name: "Não, voltar" }));

    expect(screen.getByRole("dialog", { name: "Finalizar compra" })).toBeTruthy();
    expect((screen.getByLabelText("Valor da compra") as HTMLInputElement).value).toBe("10,00");
    await user.click(screen.getByRole("button", { name: "Fechar" }));
    expect(screen.getByRole("button", { name: "Editar Sal" })).toBeTruthy();
  });

  it("corrige o valor e a forma de pagamento em Gastos", async () => {
    const user = renderApp();
    await addItems(user, "Arroz");
    await user.click(screen.getByRole("button", { name: "Finalizar compra" }));
    await user.type(screen.getByLabelText("Valor da compra"), "100");
    await user.click(screen.getByRole("radio", { name: "PIX" }));
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    await user.click(await screen.findByRole("button", { name: "Sim, finalizar" }));
    await user.click(screen.getByRole("button", { name: "Gastos" }));

    await user.click(screen.getByRole("button", { name: /^Corrigir compra de R\$\s100,00/ }));
    const sheet = await screen.findByRole("dialog", { name: "Corrigir compra" });
    const amount = within(sheet).getByLabelText("Valor da compra") as HTMLInputElement;
    expect(amount.value).toBe("100,00");
    expect((within(sheet).getByRole("radio", { name: "PIX" }) as HTMLInputElement).checked).toBe(true);

    await user.clear(amount);
    await user.type(amount, "98,50");
    await user.click(within(sheet).getByRole("radio", { name: "Dinheiro (espécie)" }));
    await user.click(within(sheet).getByRole("button", { name: "Salvar correção" }));

    expect(await screen.findByText("Compra corrigida")).toBeTruthy();
    expect(screen.getAllByText(/R\$\s98,50/).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("Dinheiro")).toBeTruthy();
    expect(screen.queryByText(/R\$\s100,00/)).toBeNull();
  });

  it("mostra em Gastos a lista do que foi comprado", async () => {
    const user = renderApp();
    await addItems(user, "2 frangos", "Sal");
    await user.click(screen.getByRole("button", { name: "Marcar Frangos como comprado" }));
    await user.click(screen.getByRole("button", { name: "Finalizar compra" }));
    await user.type(screen.getByLabelText("Valor da compra"), "50");
    await user.click(screen.getByRole("radio", { name: "PIX" }));
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    await user.click(await screen.findByRole("button", { name: "Sim, finalizar" }));
    await user.click(screen.getByRole("button", { name: "Gastos" }));

    await user.click(screen.getByText("Ver os 2 itens"));
    expect(screen.getByRole("heading", { name: "Comprados · 1" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Estavam na lista sem marcar · 1" })).toBeTruthy();
    expect(screen.getByText("Frangos")).toBeTruthy();
    expect(screen.getByText("Sal")).toBeTruthy();
  });

  it("lê o cupom pela foto, liga à lista e devolve o que faltou", async () => {
    const user = renderApp();
    await addItems(user, "Amendoim", "Café", "Leite");
    await user.click(screen.getByRole("button", { name: "Finalizar compra" }));
    await user.type(screen.getByLabelText("Valor da compra"), "20");
    await user.click(screen.getByRole("radio", { name: "PIX" }));
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    await user.click(await screen.findByRole("button", { name: "Sim, finalizar" }));
    await user.click(screen.getByRole("button", { name: "Gastos" }));

    await user.click(screen.getByRole("button", { name: /^Ler cupom da compra de R\$\s20,00/ }));
    const sheet = await screen.findByRole("dialog", { name: "Cupom fiscal" });
    const camera = sheet.querySelector("input[capture]") as HTMLInputElement;
    await user.upload(camera, new File(["x"], "cupom.jpg", { type: "image/jpeg" }));

    expect(await within(sheet).findByText("RC Comercio de Alimentos LTDA")).toBeTruthy();
    expect(receiptMocks.sent).toEqual([["l1", "FOTO"]]);
    expect(within(sheet).getByText("CNPJ 07.309.087/0001-22 · 04/11/2026")).toBeTruthy();
    expect(within(sheet).getByRole("heading", { name: "Da lista · 2" })).toBeTruthy();
    expect(within(sheet).getByRole("heading", { name: "Fora da lista · 1" })).toBeTruthy();
    expect(within(sheet).getByRole("heading", { name: "Faltou comprar · 1" })).toBeTruthy();
    const leite = within(sheet).getByLabelText("Item da lista para LTE UHT ITALAC INT 1L") as HTMLSelectElement;
    expect(leite.selectedOptions[0].textContent).toBe("É: Leite");

    // Corrigir uma ligação errada muda os grupos na hora.
    const sacola = within(sheet).getByLabelText("Item da lista para SACOLA PLASTICA");
    await user.selectOptions(sacola, "É: Café");
    expect(within(sheet).queryByRole("heading", { name: /Faltou comprar/ })).toBeNull();
    // A linha muda de grupo e o foco continua nela.
    const moved = within(sheet).getByLabelText("Item da lista para SACOLA PLASTICA");
    expect(document.activeElement).toBe(moved);
    await user.selectOptions(moved, "Fora da lista");

    await user.click(within(sheet).getByRole("checkbox", { name: "Café" }));
    expect((within(sheet).getByRole("checkbox", { name: /Usar o total do cupom/ }) as HTMLInputElement).checked).toBe(true);
    await user.click(within(sheet).getByRole("button", { name: "Salvar cupom" }));

    expect(await screen.findByText("Cupom salvo. 1 item voltou para a lista")).toBeTruthy();
    expect(screen.getAllByText(/R\$\s22,52/).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/· RC Comercio de Alimentos LTDA/)).toBeTruthy();
    await user.click(screen.getByText("Ver os 3 produtos do cupom"));
    expect(screen.getByRole("heading", { name: "Da lista · 2" })).toBeTruthy();
    expect(screen.getByText(/^R\$\s17,38$/)).toBeTruthy();

    await user.click(screen.getByRole("button", { name: /^Ver cupom da compra/ }));
    const saved = await screen.findByRole("dialog", { name: "Cupom fiscal" });
    expect(within(saved).getByRole("button", { name: "Remover cupom" })).toBeTruthy();
    await user.click(within(saved).getByRole("button", { name: "Fechar" }));

    await user.click(screen.getByRole("button", { name: "Lista" }));
    expect(screen.getByText("Café")).toBeTruthy();
  });

  it("só o QR code registra a loja e pede a foto para os produtos", async () => {
    const user = renderApp();
    await addItems(user, "Arroz");
    await user.click(screen.getByRole("button", { name: "Finalizar compra" }));
    await user.type(screen.getByLabelText("Valor da compra"), "17,38");
    await user.click(screen.getByRole("radio", { name: "PIX" }));
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    await user.click(await screen.findByRole("button", { name: "Sim, finalizar" }));
    await user.click(screen.getByRole("button", { name: "Gastos" }));
    await user.click(screen.getByRole("button", { name: /^Ler cupom/ }));

    const sheet = await screen.findByRole("dialog", { name: "Cupom fiscal" });
    const inputs = sheet.querySelectorAll("input[type=file]");
    await user.upload(inputs[2] as HTMLInputElement, new File(["x"], "qr.jpg", { type: "image/jpeg" }));
    expect(await within(sheet).findByText(/não os produtos/)).toBeTruthy();
    const sefaz = within(sheet).getByRole("link", { name: "Conferir a nota no site da Sefaz" }) as HTMLAnchorElement;
    expect(sefaz.href).toMatch(/^https:\/\/www4\.sefaz\.pb\.gov\.br\//);
    await user.click(within(sheet).getByRole("button", { name: "Salvar cupom" }));
    expect(await screen.findByText("Cupom salvo na compra")).toBeTruthy();
    expect(screen.getByRole("button", { name: /^Ver cupom da compra de R\$\s17,38/})).toBeTruthy();
  });

  it("exclui a compra pelo painel de corrigir e desfaz", async () => {
    const user = renderApp();
    await addItems(user, "Arroz");
    await user.click(screen.getByRole("button", { name: "Finalizar compra" }));
    await user.type(screen.getByLabelText("Valor da compra"), "30");
    await user.click(screen.getByRole("radio", { name: "Dinheiro (espécie)" }));
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    await user.click(await screen.findByRole("button", { name: "Sim, finalizar" }));
    await user.click(screen.getByRole("button", { name: "Gastos" }));

    await user.click(screen.getByRole("button", { name: /^Corrigir compra de R\$\s30,00/ }));
    await user.click(screen.getByRole("button", { name: "Excluir compra" }));
    const confirm = await screen.findByRole("dialog", { name: "Excluir esta compra?" });
    await user.click(within(confirm).getByRole("button", { name: "Cancelar" }));
    expect(screen.getByRole("dialog", { name: "Corrigir compra" })).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Excluir compra" }));
    await user.click(screen.getByRole("button", { name: "Excluir" }));
    expect(await screen.findByText("Nenhuma compra ainda")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Desfazer" }));
    expect(await screen.findByRole("button", { name: /^Corrigir compra de R\$\s30,00/ })).toBeTruthy();
  });

  it("parcelamento só aparece no crédito", async () => {
    const user = renderApp();
    await addItems(user, "Sal");
    await user.click(screen.getByRole("button", { name: "Finalizar compra" }));

    await user.click(screen.getByRole("radio", { name: "PIX" }));
    expect(screen.queryByRole("radio", { name: "Parcelado" })).toBeNull();
    await user.click(screen.getByRole("radio", { name: "Cartão de débito" }));
    expect(screen.queryByRole("radio", { name: "Parcelado" })).toBeNull();
    await user.click(screen.getByRole("radio", { name: "Dinheiro (espécie)" }));
    expect(screen.queryByRole("radio", { name: "Parcelado" })).toBeNull();
    await user.click(screen.getByRole("radio", { name: "Cartão de crédito" }));
    expect(screen.getByRole("radio", { name: "Parcelado" })).toBeTruthy();
  });

  it("Gastos vazio explica onde finalizar", async () => {
    const user = renderApp();
    await user.click(screen.getByRole("button", { name: "Gastos" }));
    expect(screen.getByText("Nenhuma compra ainda")).toBeTruthy();
  });

  it("cancelar a confirmação não apaga nada", async () => {
    const user = renderApp();
    await addItems(user, "Sal");
    await user.click(screen.getByRole("button", { name: "Marcar Sal como comprado" }));

    await user.click(screen.getByRole("button", { name: "Limpar a lista" }));
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.getByRole("button", { name: "Desmarcar Sal" })).toBeTruthy();
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

  it("mostra o que vai entrar ao colar uma mensagem do WhatsApp", async () => {
    const user = renderApp();
    const dialog = await openAddSheet(user);
    await user.click(within(dialog).getByRole("button", { name: "Colar vários itens de uma vez" }));

    const sheet = await screen.findByRole("dialog", { name: "Colar vários itens" });
    await user.click(within(sheet).getByLabelText("Itens"));
    await user.paste("[07/11/26, 18:02:11] Elson: *Limpeza* 🧽\n[07/11/26, 18:02:12] Elson: detergente, sabão x2");

    const preview = within(sheet).getByRole("region", { name: "O que vai entrar" });
    expect(within(preview).getByText("Vai entrar na lista Casa")).toBeTruthy();
    expect(within(preview).getByText("Limpeza")).toBeTruthy();
    expect(within(preview).getByText("Detergente")).toBeTruthy();
    expect(within(preview).getByText("2× Sabão")).toBeTruthy();
    await user.click(within(sheet).getByRole("button", { name: "Importar 2 itens" }));
    expect(await screen.findByText("2 itens importados")).toBeTruthy();
  });

  it("abre o texto compartilhado pelo WhatsApp", async () => {
    history.replaceState(null, "", `/?text=${encodeURIComponent("Pão\nLeite x3")}`);
    captureSharedText();
    expect(window.location.search).toBe("");
    renderApp();

    const sheet = await screen.findByRole("dialog", { name: "Colar vários itens" });
    expect((within(sheet).getByLabelText("Itens") as HTMLTextAreaElement).value).toBe("Pão\nLeite x3");
    expect(within(sheet).getByRole("button", { name: "Importar 2 itens" })).toBeTruthy();
  });

  it("Esc fecha o painel e devolve o foco ao botão", async () => {
    const user = renderApp();
    await openAddSheet(user);
    expect(document.activeElement).toBe(screen.getByLabelText("O que precisa comprar?"));

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Adicionar" }));
  });

  it("navega para os participantes pela barra inferior", async () => {
    const user = renderApp();
    await user.click(screen.getByRole("button", { name: "Participantes" }));

    expect(screen.getByRole("heading", { name: "Participantes" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Participantes" }).getAttribute("aria-current")).toBe("page");
  });
});
