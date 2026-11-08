import type { Op, Snapshot } from "../domain/types";
import type { ListBackend } from "./backend";
import { api } from "./http";

const PING_MS = 30_000;
const MAX_RETRY_MS = 30_000;
/** Código enviado pelo servidor quando o administrador remove este aparelho. */
const ACCESS_REMOVED = 4001;

export class ApiBackend implements ListBackend {
  private base: string;

  constructor(listId: string) {
    this.base = `/lists/${encodeURIComponent(listId)}`;
  }

  async load(): Promise<Snapshot> {
    return (await api(this.base)).json() as Promise<Snapshot>;
  }

  async apply(op: Op): Promise<void> {
    switch (op.kind) {
      case "upsert":
        await api(`${this.base}/items`, "PUT", { items: op.items });
        return;
      case "delete":
        await api(`${this.base}/items/delete`, "POST", { ids: op.ids });
        return;
      case "addCategory":
        await api(`${this.base}/categories`, "POST", { name: op.name });
        return;
      case "updatePurchase":
        await api(`${this.base}/purchases/${op.id}`, "PUT", op.payment);
        return;
      case "deletePurchase":
        await api(`${this.base}/purchases/${op.id}`, "DELETE");
        return;
      case "restorePurchase":
        await api(`${this.base}/purchases/${op.purchase.id}/restore`, "POST");
        return;
      case "setReceipt":
        await api(`${this.base}/purchases/${op.purchaseId}/receipt`, "PUT", op.receipt);
        return;
      case "removeReceipt":
        await api(`${this.base}/purchases/${op.purchaseId}/receipt`, "DELETE");
        return;
      case "updatePrices":
        await api(`${this.base}/purchases/${op.purchaseId}/prices`, "PUT", {
          prices: op.prices,
          amountCents: op.amountCents,
        });
        return;
      case "upsertTemplate":
        await api(`${this.base}/templates/${op.template.id}`, "PUT", op.template);
        return;
      case "deleteTemplate":
        await api(`${this.base}/templates/${op.id}`, "DELETE");
        return;
      case "learnBarcode":
        await api(`${this.base}/barcodes/${op.barcode.code}`, "PUT", op.barcode);
        return;
      case "finish":
        await api(`${this.base}/purchases`, "POST", { purchase: op.purchase, itemIds: op.itemIds });
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
      const url = new URL(`/api${this.base}/events`, location.href);
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
