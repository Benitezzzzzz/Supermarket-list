import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AdminList, AdminOverview } from "../../shared/contract.ts";
import { AdminSheet } from "./AdminSheet";

const casa: AdminList = { id: "l1", name: "Casa", createdAt: "", items: 3, members: [{ userId: "u1", displayName: "Renan", role: "admin" }] };
const pousada: AdminList = { id: "l2", name: "Pousada", createdAt: "", items: 0, members: [{ userId: "u2", displayName: "Pai", role: "admin" }] };

describe("AdminSheet", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("o administrador geral exclui qualquer lista, depois de confirmar", async () => {
    let lists = [casa, pousada];
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ users: [], lists } satisfies AdminOverview)),
    );
    const deleted: string[] = [];
    const user = userEvent.setup();
    render(
      <AdminSheet
        user={{ id: "u1", username: "renan", displayName: "Renan", isSuperAdmin: true }}
        onDeleteList={async (id) => {
          deleted.push(id);
          lists = lists.filter((list) => list.id !== id);
        }}
        onClose={() => {}}
      />,
    );
    const sheet = await screen.findByRole("dialog", { name: "Administração geral" });
    await within(sheet).findByText("Pousada");

    await user.click(within(sheet).getByRole("button", { name: "Excluir a lista Pousada" }));
    expect(within(sheet).getByText(/Excluir a lista Pousada\? .*Não dá para desfazer/)).toBeTruthy();
    await user.click(within(sheet).getByRole("button", { name: "Cancelar" }));
    expect(deleted).toEqual([]);

    await user.click(within(sheet).getByRole("button", { name: "Excluir a lista Pousada" }));
    await user.click(within(sheet).getByRole("button", { name: "Excluir lista" }));
    expect(await within(sheet).findByText("A lista Pousada foi excluída.")).toBeTruthy();
    expect(deleted).toEqual(["l2"]);
    expect(within(sheet).queryByText("Pousada")).toBeNull();
    expect(within(sheet).getByText("Listas · 1")).toBeTruthy();
  });
});
