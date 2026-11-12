import { describe, expect, it } from "vitest";
import { inviteCodeFromPath, inviteLink, inviteMessage } from "./invite";

const code = "0123456789abcdef0123456789abcdef";

describe("convite por link", () => {
  it("monta o link e lê o código de volta", () => {
    const link = inviteLink(code, "https://lista.exemplo");
    expect(link).toBe(`https://lista.exemplo/convite/${code}`);
    expect(inviteCodeFromPath(new URL(link).pathname)).toBe(code);
    expect(inviteCodeFromPath(`/convite/${code.toUpperCase()}/`)).toBe(code);
  });

  it("ignora endereços que não são convite", () => {
    for (const path of ["/", "/convite/", "/convite/abc", `/outra/${code}`, `/convite/${code}x`]) {
      expect(inviteCodeFromPath(path)).toBeNull();
    }
  });

  it("a mensagem é amigável e termina com o link", () => {
    const text = inviteMessage("Casa", "https://x/convite/1", "Renan Benitez");
    expect(text.startsWith("Oi! Aqui é Renan")).toBe(true);
    expect(text).toContain("*Casa*");
    expect(text.split("\n").at(-1)).toBe("https://x/convite/1");
    expect(inviteMessage("Casa", "L").startsWith("Oi! 😊")).toBe(true);
  });
});
