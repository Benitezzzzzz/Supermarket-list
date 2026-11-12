import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { captureInvite, pendingInvite } from "./invite";
import { Root } from "./Root";

const code = "c".repeat(32);

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  localStorage.clear();
  history.replaceState(null, "", "/");
});

describe("chegando pelo link de convite", () => {
  it("guarda o código, limpa o endereço e mostra o convite na tela de criar conta", async () => {
    history.replaceState(null, "", `/convite/${code}`);
    captureInvite();
    expect(location.pathname).toBe("/");
    expect(pendingInvite()).toBe(code);

    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url === `/api/invites/${code}`) return Response.json({ listName: "Casa" });
        return Response.json({ error: "Entre na sua conta" }, { status: 401 });
      }),
    );
    render(<Root />);

    expect((await screen.findByRole("status")).textContent).toContain("convite para a lista Casa");
    await waitFor(() =>
      expect(screen.getByRole("tab", { name: "Criar conta" }).getAttribute("aria-selected")).toBe("true"),
    );
    // O convite continua guardado até a pessoa entrar na lista.
    expect(pendingInvite()).toBe(code);
  });

  it("convite que não vale mais avisa e é esquecido", async () => {
    localStorage.setItem("lista:convite", code);
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        url === `/api/invites/${code}`
          ? Response.json({ error: "Este convite não vale mais." }, { status: 404 })
          : Response.json({ error: "Entre na sua conta" }, { status: 401 }),
      ),
    );
    render(<Root />);

    expect(await screen.findByText("Este convite não vale mais.")).toBeTruthy();
    expect(pendingInvite()).toBeNull();
  });
});
