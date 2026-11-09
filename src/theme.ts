/**
 * Tema de cores do app: segue o aparelho ("auto") ou fica sempre claro ou escuro.
 * A escolha fica só neste aparelho. O index.html aplica o mesmo antes de a página
 * aparecer, para não piscar o tema errado; este módulo cuida das mudanças depois.
 */

export type ThemeChoice = "auto" | "light" | "dark";

const KEY = "lista-tema";
const DARK_QUERY = "(prefers-color-scheme: dark)";
/** Cor da barra do sistema: a mesma do cabeçalho verde em cada tema. */
const BAR_COLOR = { light: "#096B49", dark: "#123826" } as const;

export function themeChoice(): ThemeChoice {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === "light" || saved === "dark") return saved;
  } catch {
    // Sem armazenamento: segue o aparelho.
  }
  return "auto";
}

function systemDark(): boolean {
  return typeof matchMedia === "function" && matchMedia(DARK_QUERY).matches;
}

/** O tema que vale agora: no Automático, o do aparelho. */
export function resolvedTheme(choice = themeChoice()): "light" | "dark" {
  return choice === "auto" ? (systemDark() ? "dark" : "light") : choice;
}

/** Aplica a escolha: o CSS lê data-theme no <html>. */
export function applyTheme(choice = themeChoice()) {
  const resolved = resolvedTheme(choice);
  document.documentElement.dataset.theme = resolved;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", BAR_COLOR[resolved]);
}

export function setThemeChoice(choice: ThemeChoice) {
  try {
    if (choice === "auto") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, choice);
  } catch {
    // Vale enquanto a página estiver aberta.
  }
  applyTheme(choice);
}

/** No modo automático, acompanha o aparelho quando ele troca de claro para escuro. */
export function followSystemTheme() {
  if (typeof matchMedia !== "function") return;
  matchMedia(DARK_QUERY).addEventListener("change", () => {
    if (themeChoice() === "auto") applyTheme("auto");
  });
}
