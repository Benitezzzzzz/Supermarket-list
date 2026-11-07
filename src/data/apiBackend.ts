import type { Op, Snapshot } from "../domain/types";
import type { ListBackend } from "./backend";
import { api } from "./http";

const PING_MS = 30_000;
const MAX_RETRY_MS = 30_000;
/** Código enviado pelo servidor quando o administrador remove este aparelho. */
const ACCESS_REMOVED = 4001;

export class ApiBackend implements ListBackend {
  async load(): Promise<Snapshot> {
    return (await api("/list")).json() as Promise<Snapshot>;
  }

  async apply(op: Op): Promise<void> {
    switch (op.kind) {
      case "upsert":
        await api("/items", "PUT", { items: op.items });
        return;
      case "delete":
        await api("/items/delete", "POST", { ids: op.ids });
        return;
      case "addCategory":
        await api("/categories", "POST", { name: op.name });
        return;
      case "updatePurchase":
        await api(`/purchases/${op.id}`, "PUT", op.payment);
        return;
      case "finish":
        await api("/purchases", "POST", { purchase: op.purchase, itemIds: op.itemIds });
        return;
    }
  }

  /** WebSocket com reconexão automática. "ready" chega a cada conexão e cobre o que se perdeu. */
  subscribe(onChange: () => void): () => void {
    let socket: WebSocket | undefined;
    let stopped = false;
    let retryMs = 1000;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let pingTimer: ReturnType<typeof setInterval> | undefined;

    const connect = () => {
      const url = new URL("/api/events", location.href);
      url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
      socket = new WebSocket(url);

      socket.addEventListener("message", (event) => {
        if (event.data === "ready" || event.data === "change") {
          retryMs = 1000;
          onChange();
        }
      });
      socket.addEventListener("close", (event) => {
        clearInterval(pingTimer);
        if (stopped) return;
        // A releitura recebe 401 e leva o app para a tela de entrada.
        if (event.code === ACCESS_REMOVED) {
          onChange();
          return;
        }
        retryTimer = setTimeout(connect, retryMs);
        retryMs = Math.min(retryMs * 2, MAX_RETRY_MS);
      });
      // Mantém a conexão viva em redes que derrubam canais parados.
      pingTimer = setInterval(() => {
        if (socket?.readyState === WebSocket.OPEN) socket.send("ping");
      }, PING_MS);
    };

    connect();
    return () => {
      stopped = true;
      clearTimeout(retryTimer);
      clearInterval(pingTimer);
      socket?.close();
    };
  }
}
