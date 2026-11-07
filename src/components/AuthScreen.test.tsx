import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { AuthScreen } from "./AuthScreen";

describe("AuthScreen", () => {
  afterEach(cleanup);

  it("aparelho antigo pode pular a transferência e só entrar", async () => {
    const user = userEvent.setup();
    render(<AuthScreen legacyName="Elson" onAuthenticated={() => {}} />);
    expect(screen.getByText(/Oi, Elson!/)).toBeTruthy();
    expect((screen.getByLabelText("Seu nome") as HTMLInputElement).value).toBe("Elson");

    await user.click(screen.getByRole("button", { name: "Já criei minha conta em outro aparelho" }));
    expect(screen.getByRole("tab", { name: "Entrar" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.queryByLabelText("Seu nome")).toBeNull();
    expect(screen.getByRole("button", { name: "Entrar" })).toBeTruthy();
  });

  it("valida antes de enviar", async () => {
    const user = userEvent.setup();
    render(<AuthScreen onAuthenticated={() => {}} />);
    await user.click(screen.getByRole("tab", { name: "Criar conta" }));
    await user.type(screen.getByLabelText("Seu nome"), "Pai");
    await user.type(screen.getByLabelText("Usuário"), "meu pai");
    await user.type(screen.getByLabelText("Senha"), "123456");
    await user.type(screen.getByLabelText("Repita a senha"), "123456");
    await user.click(screen.getByRole("button", { name: "Criar conta" }));
    expect(screen.getByRole("alert").textContent).toMatch(/sem espaço/);

    await user.clear(screen.getByLabelText("Usuário"));
    await user.type(screen.getByLabelText("Usuário"), "pai");
    await user.clear(screen.getByLabelText("Repita a senha"));
    await user.type(screen.getByLabelText("Repita a senha"), "654321");
    await user.click(screen.getByRole("button", { name: "Criar conta" }));
    expect(screen.getByRole("alert").textContent).toMatch(/não estão iguais/);
  });
});
