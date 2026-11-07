import { registerSW } from "virtual:pwa-register";

const HOUR_MS = 60 * 60 * 1000;

/**
 * Mantém o app sempre na versão publicada. Quando chega uma versão nova, a
 * página recarrega sozinha; ninguém precisa fechar e abrir o app.
 * A busca por versão nova acontece ao abrir o app, ao voltar para ele e a cada hora.
 */
export function keepAppUpdated() {
  registerSW({
    immediate: true,
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      const check = () => {
        if (document.visibilityState === "visible" && navigator.onLine) void registration.update();
      };
      document.addEventListener("visibilitychange", check);
      setInterval(check, HOUR_MS);
    },
  });
}
