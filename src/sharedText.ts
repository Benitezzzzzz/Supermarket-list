/**
 * No Android, o app instalado aparece em "Compartilhar" do WhatsApp.
 * O texto chega como ?text=... (share_target do manifesto). Ele fica guardado
 * nesta aba até a lista abrir, mesmo que antes seja preciso entrar na conta.
 */

const KEY = "lista:texto-compartilhado";

export function captureSharedText(location: Location = window.location): void {
  const params = new URLSearchParams(location.search);
  const parts = ["title", "text", "url"].map((name) => params.get(name)?.trim() ?? "").filter(Boolean);
  if (parts.length === 0) return;
  try {
    sessionStorage.setItem(KEY, parts.join("\n"));
  } catch {
    // Sem armazenamento (aba anônima restrita): o texto se perde, a lista abre normal.
  }
  for (const name of ["title", "text", "url"]) params.delete(name);
  const query = params.toString();
  history.replaceState(null, "", `${location.pathname}${query ? `?${query}` : ""}${location.hash}`);
}

/** Entrega o texto compartilhado uma única vez. */
export function takeSharedText(): string | null {
  try {
    const text = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
    return text;
  } catch {
    return null;
  }
}
