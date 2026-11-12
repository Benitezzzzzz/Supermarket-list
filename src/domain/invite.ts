/** O caminho do link de convite: /convite/<código>. */
export const INVITE_PATH = "/convite/";

export function inviteLink(code: string, origin: string = location.origin): string {
  return `${origin}${INVITE_PATH}${code}`;
}

/** O código de um endereço /convite/<código>, ou null. */
export function inviteCodeFromPath(pathname: string): string | null {
  if (!pathname.startsWith(INVITE_PATH)) return null;
  const code = pathname.slice(INVITE_PATH.length).replace(/\/+$/, "").toLowerCase();
  return /^[0-9a-f]{32}$/.test(code) ? code : null;
}

/** A mensagem que vai pelo WhatsApp: um convite amigável e, no fim, o link da lista. */
export function inviteMessage(listName: string, link: string, fromName?: string): string {
  const greeting = fromName ? `Oi! Aqui é ${fromName.split(/\s+/)[0]} 😊` : "Oi! 😊";
  return [
    greeting,
    `Quero te chamar para a nossa lista de mercado *${listName}* 🛒`,
    "",
    "Por ela a gente vê na hora o que falta comprar, marca o que já foi para o carrinho e acompanha os gastos juntos.",
    "",
    "É só tocar no link, entrar ou criar sua conta, e você já cai direto na lista:",
    link,
  ].join("\n");
}
