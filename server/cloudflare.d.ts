/**
 * Tipos mínimos do runtime da Cloudflare usados pelo servidor.
 * Declarados aqui para não misturar os tipos completos dos Workers com os do
 * navegador, já que frontend e backend compartilham o mesmo tsconfig.
 */

interface ResponseInit {
  webSocket?: WebSocket | null;
}

interface Response {
  readonly webSocket: WebSocket | null;
}

declare class WebSocketPair {
  0: WebSocket;
  1: WebSocket;
}

declare class WebSocketRequestResponsePair {
  constructor(request: string, response: string);
}

interface DurableObjectState {
  acceptWebSocket(socket: WebSocket, tags?: string[]): void;
  getWebSockets(tag?: string): WebSocket[];
  setWebSocketAutoResponse(pair: WebSocketRequestResponsePair): void;
}

interface DurableObjectId {
  toString(): string;
}

interface DurableObjectStub {
  fetch(request: Request): Promise<Response>;
}

interface DurableObjectNamespace {
  idFromName(name: string): DurableObjectId;
  get(id: DurableObjectId): DurableObjectStub;
}

declare module "cloudflare:workers" {
  export abstract class DurableObject<Env = unknown> {
    protected ctx: DurableObjectState;
    protected env: Env;
    constructor(ctx: DurableObjectState, env: Env);
  }
}
