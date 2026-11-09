import { useCallback, useEffect, useState } from "react";

const KEY = "lista-tela-acesa";

/** O navegador permite pedir que a tela não apague (Chrome/Edge no Android, Safari no iPhone recente). */
export const canKeepAwake = typeof navigator !== "undefined" && "wakeLock" in navigator;

function saved(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * Modo mercado: enquanto a lista está aberta, a tela não apaga sozinha. A escolha fica
 * no aparelho. O sistema solta a trava quando o app vai para o fundo; ela é pedida de novo
 * quando o app volta. `active` é falso fora da tela da lista: a trava só vale nela.
 */
export function useKeepAwake(active = true) {
  const [enabled, setEnabled] = useState(() => canKeepAwake && saved());

  useEffect(() => {
    if (!enabled || !active || !canKeepAwake) return;
    let sentinel: WakeLockSentinel | null = null;
    let stopped = false;
    const request = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        sentinel = await navigator.wakeLock.request("screen");
        if (stopped) void sentinel.release();
      } catch {
        // Bateria fraca ou o sistema negou: a tela volta a apagar normalmente.
      }
    };
    const onVisible = () => void request();
    void request();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      document.removeEventListener("visibilitychange", onVisible);
      void sentinel?.release();
    };
  }, [enabled, active]);

  const toggle = useCallback(() => {
    setEnabled((current) => {
      const next = !current;
      try {
        if (next) localStorage.setItem(KEY, "1");
        else localStorage.removeItem(KEY);
      } catch {
        // Vale enquanto a página estiver aberta.
      }
      return next;
    });
  }, []);

  return { enabled, toggle };
}
