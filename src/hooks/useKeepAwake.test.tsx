import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

describe("modo mercado", () => {
  afterEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("pede a tela acesa ao ligar, lembra a escolha e solta ao desligar", async () => {
    const release = vi.fn(async () => {});
    const request = vi.fn(async () => ({ release }));
    vi.stubGlobal("navigator", { ...navigator, wakeLock: { request } });
    const { useKeepAwake, canKeepAwake } = await import("./useKeepAwake");
    expect(canKeepAwake).toBe(true);

    const { result } = renderHook(() => useKeepAwake());
    expect(result.current.enabled).toBe(false);
    await act(async () => result.current.toggle());
    expect(request).toHaveBeenCalledWith("screen");
    expect(localStorage.getItem("lista-tela-acesa")).toBe("1");

    await act(async () => result.current.toggle());
    expect(release).toHaveBeenCalled();
    expect(localStorage.getItem("lista-tela-acesa")).toBeNull();
  });
});
