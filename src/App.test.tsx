import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import { applyOp } from "./data/applyOp";
import type { ListBackend } from "./data/backend";
import { SyncedList } from "./data/syncedList";
import { captureSharedText } from "./sharedText";
import type { ListSummary, Op, ReceiptReading, Snapshot, UserInfo } from "./domain/types";

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
  } as ReceiptReading,
  sent: [] as string[][],
  barcode: "7896058599848" as string | null,
}));

vi.mock("./data/receiptImage", () => ({
  preparePhoto: async () => ({ base64: "FOTO", qrText: receiptMocks.qr }),
  qrFromPhoto: async () => receiptMocks.qr,
  barcodeFromPhoto: async () => receiptMocks.barcode,
  scanVideo: () => () => {},
}));
vi.mock("./data/receiptsApi", () => ({
  readReceiptPhoto: async (listId: string, base64: string) => {
    receiptMocks.sent.push([listId, base64]);
    return receiptMocks.reading;
  },
}));

class MemoryBackend implements ListBackend {
  snapshot: Snapshot = { items: [], customCategories: [], purchases: [], templates: [], barcodes: [] };
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
      onRenameList={async (id, name) => {
        if (name === "Falha") throw new Error("sem internet");
        calls.push(`rename:${id}:${name}`);
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
    receiptMocks.sent.length = 0;
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

  it("aprende o código de barras na primeira vez e depois adiciona sozinho", async () => {
    const user = renderApp();
    let dialog = await openAddSheet(user);
    const photo = () => dialog.querySelector("input[type=file]") as HTMLInputElement;
    // Sem câmera ao vivo (como aqui), o app pede a foto do código.
    await user.click(within(dialog).getByRole("button", { name: "Ler código de barras" }));
    await user.upload(photo(), new File(["x"], "codigo.jpg", { type: "image/jpeg" }));
    expect(await within(dialog).findByText(/Ainda não conheço o código 7896058599848/)).toBeTruthy();
    await user.type(within(dialog).getByLabelText("O que precisa comprar?"), "Leite Italac{Enter}");
    expect(within(dialog).getByText("1× Leite Italac entrou na lista.")).toBeTruthy();
    expect(within(dialog).queryByText(/Ainda não conheço/)).toBeNull();
    await user.click(within(dialog).getByRole("button", { name: "Fechar" }));

    await user.click(screen.getByRole("button", { name: "Editar Leite Italac" }));
    await user.click(await screen.findByRole("button", { name: "Tirar da lista" }));
    dialog = await openAddSheet(user);
    await user.click(within(dialog).getByRole("button", { name: "Ler código de barras" }));
    await user.upload(photo(), new File(["x"], "codigo.jpg", { type: "image/jpeg" }));
    expect(await within(dialog).findByText("1× Leite Italac entrou na lista.")).toBeTruthy();
    await user.click(within(dialog).getByRole("button", { name: "Fechar" }));
    expect(screen.getByRole("button", { name: "Marcar Leite Italac como comprado" })).toBeTruthy();

    receiptMocks.barcode = null;
    dialog = await openAddSheet(user);
    await user.click(within(dialog).getByRole("button", { name: "Ler código de barras" }));
    await user.upload(photo(), new File(["x"], "codigo.jpg", { type: "image/jpeg" }));
    expect((await within(dialog).findByRole("alert")).textContent).toMatch(/Não achei o código de barras/);
    receiptMocks.barcode = "7896058599848";
  });

  it("o botão de tema do cabeçalho abre claro, escuro e automático, e guarda neste aparelho", async () => {
    const user = renderApp();
    await user.click(screen.getByRole("button", { name: "Tema e tela" }));
    const sheet = await screen.findByRole("dialog", { name: "Tema e tela" });
    expect((within(sheet).getByRole("radio", { name: /Automático/ }) as HTMLInputElement).checked).toBe(true);

    await user.click(within(sheet).getByRole("radio", { name: /Escuro/ }));
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(localStorage.getItem("lista-tema")).toBe("dark");

    await user.click(within(sheet).getByRole("radio", { name: /Claro/ }));
    expect(document.documentElement.dataset.theme).toBe("light");

    await user.click(within(sheet).getByRole("radio", { name: /Automático/ }));
    expect(localStorage.getItem("lista-tema")).toBeNull();
  });

  it("muda o nome da lista que a pessoa administra", async () => {
    const user = renderApp();
    await user.click(screen.getByRole("button", { name: "Lista Casa. Trocar de lista" }));
    const sheet = await screen.findByRole("dialog", { name: "Suas listas" });
    // Na Pousada a pessoa só participa: não aparece o lápis.
    expect(within(sheet).queryByRole("button", { name: "Mudar o nome da lista Pousada" })).toBeNull();

    await user.click(within(sheet).getByRole("button", { name: "Mudar o nome da lista Casa" }));
    const field = within(sheet).getByLabelText("Nome da lista") as HTMLInputElement;
    expect(field.value).toBe("Casa");
    await user.clear(field);
    await user.click(within(sheet).getByRole("button", { name: "Salvar nome" }));
    expect(within(sheet).getByRole("alert").textContent).toBe("Dê um nome para a lista.");

    await user.type(field, "Falha");
    await user.click(within(sheet).getByRole("button", { name: "Salvar nome" }));
    expect((await within(sheet).findByRole("alert")).textContent).toMatch(/Não consegui mudar o nome/);

    await user.clear(field);
    await user.type(field, "Casa da família{Enter}");
    expect(await within(sheet).findByText("A lista agora se chama Casa da família.")).toBeTruthy();
    expect(calls).toEqual(["rename:l1:Casa da família"]);
    expect(within(sheet).queryByLabelText("Nome da lista")).toBeNull();
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
    expect(await within(dialog).findByText("1× Arroz entrou na lista.")).toBeTruthy();
    await user.type(within(dialog).getByLabelText("O que precisa comprar?"), "Feijão{Enter}");
    expect(await within(dialog).findByText("1× Feijão entrou na lista.")).toBeTruthy();
    await user.type(within(dialog).getByLabelText("O que precisa comprar?"), "peixe 2x");
    expect(within(dialog).getByText("2× Peixe")).toBeTruthy();
    await user.keyboard("{Enter}");
    expect(await within(dialog).findByText("2× Peixe entrou na lista.")).toBeTruthy();
    await user.click(within(dialog).getByRole("button", { name: "Fechar" }));

    expect(screen.getByRole("heading", { name: /^Outros/ })).toBeTruthy();
    expect(screen.getByText("Oi, Renan! Faltam 3 itens.")).toBeTruthy();
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
    expect(ordem.filter((n) => !/^(Editar|Menos|Mais) /.test(n ?? ""))).toEqual(["Desmarcar Arroz", "Marcar Feijão como comprado"]);
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

  it("muda a quantidade com − e + na própria linha", async () => {
    const user = renderApp();
    await addItems(user, "Arroz");
    const row = () => screen.getByRole("button", { name: "Marcar Arroz como comprado" }).closest("li") as HTMLElement;
    expect(row().textContent).toContain("1×");
    expect((within(row()).getByRole("button", { name: "Menos Arroz" }) as HTMLButtonElement).disabled).toBe(true);
    await user.click(within(row()).getByRole("button", { name: "Mais Arroz" }));
    await user.click(within(row()).getByRole("button", { name: "Mais Arroz" }));
    expect(row().textContent).toContain("3×");
    await user.click(within(row()).getByRole("button", { name: "Menos Arroz" }));
    expect(row().textContent).toContain("2×");
  });

  it("lê o cupom já no Finalizar, preenche o valor e salva a compra como modelo", async () => {
    const user = renderApp();
    await addItems(user, "Amendoim", "Café", "Leite");
    await user.click(screen.getByRole("button", { name: "Finalizar compra" }));
    await user.click(await screen.findByRole("button", { name: /Ler o cupom fiscal/ }));

    const sheet = await screen.findByRole("dialog", { name: "Cupom fiscal" });
    const camera = sheet.querySelector("input[capture]") as HTMLInputElement;
    await user.upload(camera, new File(["x"], "cupom.jpg", { type: "image/jpeg" }));
    expect(await within(sheet).findByText("RC Comercio de Alimentos LTDA")).toBeTruthy();
    // Ainda não há valor digitado: não pergunta se usa o total do cupom.
    expect(within(sheet).queryByRole("checkbox", { name: /Usar o total do cupom/ })).toBeNull();
    await user.click(within(sheet).getByRole("button", { name: "Continuar para o pagamento" }));

    const form = await screen.findByRole("dialog", { name: "Finalizar compra" });
    expect(within(form).getByRole("status").textContent).toMatch(/Cupom lido/);
    expect((within(form).getByLabelText("Valor da compra") as HTMLInputElement).value).toBe("22,52");
    await user.click(within(form).getByRole("radio", { name: "PIX" }));
    await user.click(within(form).getByRole("button", { name: "Continuar" }));

    const confirm = await screen.findByRole("dialog", { name: "Finalizar lista?" });
    expect(within(confirm).getByText(/O cupom lido vai junto/)).toBeTruthy();
    await user.click(within(confirm).getByRole("checkbox", { name: /Salvar como modelo de lista/ }));
    await user.click(within(confirm).getByRole("button", { name: "Sim, finalizar" }));

    const editor = await screen.findByRole("dialog", { name: "Novo modelo" });
    expect(within(editor).getByText("Amendoim")).toBeTruthy();
    const category = within(editor).getByRole("combobox", { name: "Categoria de Café" }) as HTMLSelectElement;
    await user.selectOptions(category, "Mercearia");
    await user.type(within(editor).getByLabelText("Nome do modelo"), "Feira");
    await user.click(within(editor).getByRole("button", { name: "Salvar modelo" }));
    expect(await screen.findByText("Modelo Feira salvo")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Fechar" }));
    await user.click(screen.getByRole("button", { name: "Gastos" }));
    expect(screen.getAllByText(/R\$\s22,52/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole("region", { name: "Por mercado" })).toBeTruthy();
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

    await user.click(screen.getByRole("button", { name: /^Compra de R\$\s100,00/ }));
    await user.click(screen.getByRole("button", { name: /^Editar compra de R\$\s100,00/ }));
    const sheet = await screen.findByRole("dialog", { name: "Editar compra" });
    const amount = within(sheet).getByLabelText("Valor da compra") as HTMLInputElement;
    expect(amount.value).toBe("100,00");
    expect((within(sheet).getByRole("radio", { name: "PIX" }) as HTMLInputElement).checked).toBe(true);

    await user.clear(amount);
    await user.type(amount, "98,50");
    await user.click(within(sheet).getByRole("radio", { name: "Dinheiro (espécie)" }));
    await user.click(within(sheet).getByRole("button", { name: "Salvar alterações" }));

    expect(await screen.findByText("Compra atualizada")).toBeTruthy();
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

    const card = screen.getByRole("button", { name: /^Compra de R\$\s50,00/ });
    expect(card.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("heading", { name: "Comprados · 1" })).toBeNull();
    await user.click(card);
    expect(card.getAttribute("aria-expanded")).toBe("true");
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

    await user.click(screen.getByRole("button", { name: /^Compra de R\$\s20,00/ }));
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
    expect(leite.selectedOptions[0].textContent).toBe("É: 1× Leite");

    // Corrigir uma ligação errada muda os grupos na hora.
    const sacola = within(sheet).getByLabelText("Item da lista para SACOLA PLASTICA");
    await user.selectOptions(sacola, "É: 1× Café");
    expect(within(sheet).queryByRole("heading", { name: /Faltou comprar/ })).toBeNull();
    // A linha muda de grupo e o foco continua nela.
    const moved = within(sheet).getByLabelText("Item da lista para SACOLA PLASTICA");
    expect(document.activeElement).toBe(moved);
    await user.selectOptions(moved, "Fora da lista");

    await user.click(within(sheet).getByRole("checkbox", { name: "1× Café" }));
    expect((within(sheet).getByRole("checkbox", { name: /Usar o total do cupom/ }) as HTMLInputElement).checked).toBe(true);
    await user.click(within(sheet).getByRole("button", { name: "Salvar cupom" }));

    expect(await screen.findByText("Cupom salvo. 1 item voltou para a lista")).toBeTruthy();
    expect(screen.getAllByText(/R\$\s22,52/).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/· por Renan · RC$/)).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Da lista · 2" })).toBeTruthy();
    expect(screen.getByText(/^R\$\s17,38$/)).toBeTruthy();

    await user.click(screen.getByRole("button", { name: /^Ver cupom da compra/ }));
    const saved = await screen.findByRole("dialog", { name: "Cupom fiscal" });
    expect(within(saved).getByRole("button", { name: "Remover cupom" })).toBeTruthy();
    await user.click(within(saved).getByRole("button", { name: "Fechar" }));

    await user.click(screen.getByRole("button", { name: "Lista" }));
    expect(screen.getByText("Café")).toBeTruthy();
  });

  it("cupom grande: soma a foto da continuação sem repetir produtos", async () => {
    const user = renderApp();
    await addItems(user, "Amendoim", "Café", "Leite");
    await user.click(screen.getByRole("button", { name: "Finalizar compra" }));
    await user.type(screen.getByLabelText("Valor da compra"), "20");
    await user.click(screen.getByRole("radio", { name: "PIX" }));
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    await user.click(await screen.findByRole("button", { name: "Sim, finalizar" }));
    await user.click(screen.getByRole("button", { name: "Gastos" }));
    await user.click(screen.getByRole("button", { name: /^Compra de R\$\s20,00/ }));
    await user.click(screen.getByRole("button", { name: /^Ler cupom da compra de R\$\s20,00/ }));

    const sheet = await screen.findByRole("dialog", { name: "Cupom fiscal" });
    const first = receiptMocks.reading;
    receiptMocks.reading = { ...first, totalCents: null, items: first.items.slice(0, 2) };
    await user.upload(sheet.querySelector("input[capture]") as HTMLInputElement, new File(["x"], "topo.jpg", { type: "image/jpeg" }));
    expect(await within(sheet).findByText("AMENDOIM PETTIZ CROC 120G")).toBeTruthy();
    expect(within(sheet).queryByText("SACOLA PLASTICA")).toBeNull();

    // A continuação repete o leite (fotos sobrepostas) e traz a sacola e o total.
    receiptMocks.reading = { ...first, storeName: "", items: first.items.slice(1) };
    expect(within(sheet).getByRole("button", { name: "Foto da continuação" })).toBeTruthy();
    await user.upload(
      sheet.querySelector('input[data-parte="camera"]') as HTMLInputElement,
      new File(["x"], "fim.jpg", { type: "image/jpeg" }),
    );
    expect(await within(sheet).findByText("SACOLA PLASTICA")).toBeTruthy();
    expect(within(sheet).getAllByText("LTE UHT ITALAC INT 1L")).toHaveLength(1);
    expect(within(sheet).getByText(/Lido de 2 fotos/)).toBeTruthy();
    expect(within(sheet).getByText("RC Comercio de Alimentos LTDA")).toBeTruthy();
    expect(within(sheet).getByRole("checkbox", { name: /Usar o total do cupom \(R\$\s22,52\)/ })).toBeTruthy();
    receiptMocks.reading = first;
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
    await user.click(screen.getByRole("button", { name: /^Compra de R\$\s17,38/ }));
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

  it("exclui a compra pelo card aberto e desfaz", async () => {
    const user = renderApp();
    await addItems(user, "Arroz");
    await user.click(screen.getByRole("button", { name: "Finalizar compra" }));
    await user.type(screen.getByLabelText("Valor da compra"), "30");
    await user.click(screen.getByRole("radio", { name: "Dinheiro (espécie)" }));
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    await user.click(await screen.findByRole("button", { name: "Sim, finalizar" }));
    await user.click(screen.getByRole("button", { name: "Gastos" }));

    await user.click(screen.getByRole("button", { name: /^Compra de R\$\s30,00/ }));
    await user.click(screen.getByRole("button", { name: /^Excluir compra de R\$\s30,00/ }));
    const confirm = await screen.findByRole("dialog", { name: "Excluir esta compra?" });
    await user.click(within(confirm).getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByRole("dialog")).toBeNull();

    await user.click(screen.getByRole("button", { name: /^Excluir compra de R\$\s30,00/ }));
    await user.click(screen.getByRole("button", { name: "Excluir" }));
    expect(await screen.findByText("Nenhuma compra ainda")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Desfazer" }));
    expect(await screen.findByRole("button", { name: /^Compra de R\$\s30,00/ })).toBeTruthy();
  });

  it("gera o PDF de uma compra pela impressão do navegador", async () => {
    const print = vi.spyOn(window, "print").mockImplementation(() => {});
    const user = renderApp();
    await addItems(user, "Arroz", "Feijão");
    await user.click(screen.getByRole("button", { name: "Marcar Arroz como comprado" }));
    await user.click(screen.getByRole("button", { name: "Finalizar compra" }));
    await user.type(screen.getByLabelText("Valor da compra"), "42");
    await user.click(screen.getByRole("radio", { name: "PIX" }));
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    await user.click(await screen.findByRole("button", { name: "Sim, finalizar" }));
    await user.click(screen.getByRole("button", { name: "Gastos" }));

    const before = document.title;
    await user.click(screen.getByRole("button", { name: /^Compra de R\$\s42,00/ }));
    await user.click(screen.getByRole("button", { name: /^Gerar PDF da compra de R\$\s42,00/ }));
    await waitFor(() => expect(print).toHaveBeenCalledTimes(1));
    const report = document.querySelector(".print-report") as HTMLElement;
    expect(report.textContent).toMatch(/Compra de \d+ de \w+ de \d{4}/);
    expect(report.textContent).toContain("PIX");
    expect(report.textContent).toContain("Feijão");
    expect(document.title).toMatch(/^Compra .+ \d{4}-\d{2}-\d{2}$/);

    act(() => {
      window.dispatchEvent(new Event("afterprint"));
    });
    expect(document.querySelector(".print-report")).toBeNull();
    expect(document.title).toBe(before);
    print.mockRestore();
  });

  async function finishPurchase(user: User, amount: string) {
    await user.click(screen.getByRole("button", { name: "Finalizar compra" }));
    await user.type(screen.getByLabelText("Valor da compra"), amount);
    await user.click(screen.getByRole("radio", { name: "PIX" }));
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    await user.click(await screen.findByRole("button", { name: "Sim, finalizar" }));
  }

  it("Gastos mostra o mês, o gráfico e compara com a compra anterior", async () => {
    const user = renderApp();
    await addItems(user, "Arroz");
    await finishPurchase(user, "100");
    await addItems(user, "Feijão");
    await finishPurchase(user, "120");
    await user.click(screen.getByRole("button", { name: "Gastos" }));

    const month = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(new Date());
    const summary = screen.getByRole("region", { name: `Total de ${month}` });
    expect(within(summary).getByText(/R\$\s220,00/)).toBeTruthy();
    expect(within(summary).getByText(/2 compras · média de R\$\s110,00/)).toBeTruthy();
    const bar = screen.getByRole("button", { name: new RegExp(`^${month}: R\\$\\s220,00, 2 compras`) });
    expect(bar.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("heading", { name: new RegExp(month) })).toBeTruthy();

    await user.click(screen.getByRole("button", { name: /^Compra de R\$\s120,00/ }));
    expect(screen.getByText(/R\$\s20,00 a mais que a compra de/)).toBeTruthy();
    expect(screen.getByText(/\(\+20%\)/)).toBeTruthy();

    // Escolher um mês no gráfico mostra só as compras dele.
    await user.click(bar);
    expect(screen.getByText(`Compras de ${month}`)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Ver todas" }));
    expect(screen.queryByText(`Compras de ${month}`)).toBeNull();
  });

  it("anota preço e marca, atualiza o total e mostra a última compra como referência", async () => {
    const user = renderApp();
    await addItems(user, "2 leite", "Café");
    await user.click(screen.getByRole("button", { name: "Marcar Leite como comprado" }));
    await user.click(screen.getByRole("button", { name: "Marcar Café como comprado" }));
    await finishPurchase(user, "30");
    await user.click(screen.getByRole("button", { name: "Gastos" }));

    await user.click(screen.getByRole("button", { name: /^Compra de R\$\s30,00/ }));
    await user.click(screen.getByRole("button", { name: /^Preços e marcas da compra de R\$\s30,00/ }));
    const sheet = await screen.findByRole("dialog", { name: "Preços e marcas" });
    await user.type(within(sheet).getByLabelText("Preço de Leite"), "5,49");
    await user.type(within(sheet).getByLabelText("Marca de Leite"), "Italac");
    // Só um dos dois tem preço: a soma não vira o valor sozinha.
    const useSum = within(sheet).getByRole("checkbox", { name: /Usar a soma/ }) as HTMLInputElement;
    expect(useSum.checked).toBe(false);
    await user.type(within(sheet).getByLabelText("Preço de Café"), "abc");
    await user.click(within(sheet).getByRole("button", { name: "Salvar preços" }));
    expect(within(sheet).getByRole("alert").textContent).toMatch(/preço de Café não está certo/);
    await user.clear(within(sheet).getByLabelText("Preço de Café"));
    await user.type(within(sheet).getByLabelText("Preço de Café"), "12,90");
    expect(within(sheet).getByText(/R\$\s23,88/)).toBeTruthy();
    await user.click(useSum);
    await user.click(within(sheet).getByRole("button", { name: "Salvar preços" }));

    expect(await screen.findByText("Preços salvos e valor da compra atualizado")).toBeTruthy();
    expect(screen.getByRole("button", { name: /^Compra de R\$\s23,88/ })).toBeTruthy();
    expect(screen.getByText(/^Italac · 2 × R\$\s5,49$/)).toBeTruthy();

    // Na próxima compra, o preço antigo aparece só como referência.
    await user.click(screen.getByRole("button", { name: "Lista" }));
    const dialog = await openAddSheet(user);
    await user.type(within(dialog).getByLabelText("O que precisa comprar?"), "leites");
    expect(within(dialog).getByText(/Última compra de Leite: R\$\s5,49 cada · Italac/)).toBeTruthy();
    await user.type(within(dialog).getByLabelText("O que precisa comprar?"), "{Enter}");
    await user.click(within(dialog).getByRole("button", { name: "Fechar" }));
    expect(screen.getByText(/Última: R\$\s5,49 · Italac/)).toBeTruthy();
    expect(screen.getByText(/Estimativa:/).textContent).toMatch(/Estimativa: R\$\s5,49$/);

    await user.click(screen.getByRole("button", { name: "Editar leites" }));
    const edit = await screen.findByRole("dialog", { name: "leites" });
    expect(within(edit).getByText(/R\$\s5,49 cada · Italac/)).toBeTruthy();
  });

  it("salva a lista como modelo padrão e começa uma nova compra por ele", async () => {
    const user = renderApp();
    await addItems(user, "Arroz", "2 leite");
    await user.click(screen.getByRole("button", { name: "Modelos de lista" }));
    let sheet = await screen.findByRole("dialog", { name: "Modelos de lista" });
    await user.click(within(sheet).getByRole("button", { name: "Salvar a lista atual como modelo" }));
    sheet = await screen.findByRole("dialog", { name: "Novo modelo" });
    await user.click(within(sheet).getByRole("button", { name: "Salvar modelo" }));
    expect(within(sheet).getByRole("alert").textContent).toMatch(/Dê um nome/);
    await user.type(within(sheet).getByLabelText("Nome do modelo"), "Compra do mês");
    expect((within(sheet).getByRole("checkbox", { name: /modelo padrão/ }) as HTMLInputElement).checked).toBe(true);
    await user.click(within(sheet).getByRole("button", { name: `Tirar Arroz do modelo` }));
    await user.type(within(sheet).getByLabelText("Novo item do modelo"), "Café{Enter}");
    await user.click(within(sheet).getByRole("button", { name: "Aumentar quantidade de Café" }));
    await user.click(within(sheet).getByRole("button", { name: "Salvar modelo" }));

    sheet = await screen.findByRole("dialog", { name: "Modelos de lista" });
    expect(within(sheet).getByText("Padrão")).toBeTruthy();
    expect(within(sheet).getByText("2 itens")).toBeTruthy();
    await user.click(within(sheet).getByRole("button", { name: "Fechar" }));

    await finishPurchase(user, "50");
    expect(screen.getByText("Lista vazia")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Usar “Compra do mês”" }));
    expect(await screen.findByText("2 itens de Compra do mês entraram na lista")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Marcar Leite como comprado" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Marcar Café como comprado" }).closest("li")?.textContent).toContain("2×");

    // Usar de novo não duplica o que já está na lista.
    await user.click(screen.getByRole("button", { name: "Modelos de lista" }));
    sheet = await screen.findByRole("dialog", { name: "Modelos de lista" });
    await user.click(within(sheet).getByRole("button", { name: "Usar o modelo Compra do mês" }));
    expect(await screen.findByText("Os itens de Compra do mês já estão na lista")).toBeTruthy();
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
    expect(within(preview).getByText("1× Detergente")).toBeTruthy();
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
