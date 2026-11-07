import { DurableObject } from "cloudflare:workers";

/**
 * Um por família. Guarda os WebSockets abertos e avisa quando a lista muda.
 * Usa a API de hibernação: com todos parados, o objeto dorme e não consome a
 * cota de tempo de execução.
 */
export class FamilyEvents extends DurableObject {
  constructor(ctx: DurableObjectState, env: unknown) {
    super(ctx, env);
    // O ping do aplicativo é respondido sem acordar o objeto.
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair("ping", "pong"));
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const memberId = url.searchParams.get("member") ?? "";

    switch (url.pathname) {
      case "/connect": {
        if (request.headers.get("upgrade") !== "websocket") {
          return new Response("Esperado WebSocket", { status: 426 });
        }
        const pair = new WebSocketPair();
        this.ctx.acceptWebSocket(pair[1], [memberId]);
        pair[1].send("ready");
        return new Response(null, { status: 101, webSocket: pair[0] });
      }
      case "/notify":
        for (const socket of this.ctx.getWebSockets()) {
          try {
            socket.send("change");
          } catch {
            // Conexão já fechada; o runtime a remove sozinho.
          }
        }
        return new Response(null, { status: 204 });
      case "/disconnect":
        for (const socket of this.ctx.getWebSockets(memberId)) {
          socket.close(4001, "Acesso removido");
        }
        return new Response(null, { status: 204 });
      default:
        return new Response("Não encontrado", { status: 404 });
    }
  }

  async webSocketClose(socket: WebSocket, code: number) {
    // 1005, 1006 e 1015 só descrevem o fechamento recebido; não podem ser enviados.
    const reserved = code === 1005 || code === 1006 || code === 1015;
    socket.close(reserved ? 1000 : code, "Encerrado");
  }
}
