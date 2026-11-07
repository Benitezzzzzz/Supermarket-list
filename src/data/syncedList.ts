import type { Item, Op, Purchase, Snapshot } from "../domain/types";
import { applyOp } from "./applyOp";
import { AccessRevokedError, type ListBackend, RejectedOpError } from "./backend";

export type ConnectionStatus = "loading" | "online" | "offline";

export interface ListState {
  items: Item[];
  customCategories: string[];
  purchases: Purchase[];
  connection: ConnectionStatus;
  pendingCount: number;
  /** Alguma alteração foi recusada pelo servidor e descartada. */
  rejected: boolean;
  /** O servidor não reconhece mais este aparelho. */
  accessRevoked: boolean;
}

interface Persisted {
  base: Snapshot;
  queue: Op[];
}

const RETRY_MS = 5000;
const EMPTY: Snapshot = { items: [], customCategories: [], purchases: [] };

/**
 * Lista com escrita otimista e fila offline.
 *
 * `base` é a última versão confirmada pelo servidor e `queue` guarda o que
 * ainda não foi enviado. A tela mostra `base` + `queue`, então a pessoa nunca
 * espera a rede, e alterações de aparelhos diferentes não se sobrescrevem:
 * cada operação mexe só nos itens dela.
 */
export class SyncedList {
  private base: Snapshot = EMPTY;
  private queue: Op[] = [];
  private flushing = false;
  private loadSeq = 0;
  private retryTimer: ReturnType<typeof setTimeout> | undefined;
  private listeners = new Set<() => void>();
  private state: ListState = {
    ...EMPTY,
    connection: "loading",
    pendingCount: 0,
    rejected: false,
    accessRevoked: false,
  };
  private backend: ListBackend;
  private storageKey: string;

  constructor(backend: ListBackend, storageKey: string) {
    this.backend = backend;
    this.storageKey = storageKey;
    this.restore();
    this.publish({});
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getState = () => this.state;

  /** Conecta ao servidor. Retorna a função que desconecta. */
  start(): () => void {
    const unsubscribe = this.backend.subscribe(() => void this.refresh());
    const onVisible = () => {
      if (document.visibilityState === "visible") void this.sync();
    };
    const onOnline = () => void this.sync();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onOnline);
    void this.sync();

    return () => {
      unsubscribe();
      clearTimeout(this.retryTimer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onOnline);
    };
  }

  /** Envia a fila e depois busca a versão mais recente. */
  async sync(): Promise<void> {
    clearTimeout(this.retryTimer);
    if (this.flushing) return;
    this.flushing = true;

    while (this.queue.length > 0) {
      try {
        await this.backend.apply(this.queue[0]);
      } catch (error) {
        if (error instanceof RejectedOpError) {
          this.queue.shift();
          this.commit({ rejected: true });
          continue;
        }
        this.flushing = false;
        this.handleFailure(error);
        return;
      }
      // O item enviado entra na base antes de sair da fila, sem piscar na tela.
      this.base = applyOp(this.base, this.queue.shift()!);
      this.commit({});
    }

    this.flushing = false;
    await this.refresh();
  }

  async refresh(): Promise<void> {
    const seq = ++this.loadSeq;
    try {
      const snapshot = await this.backend.load();
      if (seq !== this.loadSeq) return; // chegou uma resposta mais nova
      this.base = { ...EMPTY, ...snapshot };
      this.commit({ connection: "online" });
    } catch (error) {
      if (seq === this.loadSeq) this.handleFailure(error);
    }
  }

  addItems(items: Item[]) {
    if (items.length > 0) this.dispatch({ kind: "upsert", items });
  }

  updateItem(id: string, changes: Partial<Pick<Item, "done" | "category" | "quantity">>) {
    const item = this.state.items.find((i) => i.id === id);
    if (item) this.dispatch({ kind: "upsert", items: [{ ...item, ...changes }] });
  }

  removeItems(ids: string[]) {
    if (ids.length > 0) this.dispatch({ kind: "delete", ids });
  }

  /** Registra a compra e tira da lista os itens que existiam nesta hora. */
  finishShopping(purchase: Purchase, itemIds: string[]) {
    this.dispatch({ kind: "finish", purchase, itemIds });
  }

  addCategory(name: string) {
    this.dispatch({ kind: "addCategory", name });
  }

  private dispatch(op: Op) {
    this.queue.push(op);
    this.commit({});
    void this.sync();
  }

  private handleFailure(error: unknown) {
    if (error instanceof AccessRevokedError) {
      // A fila fica salva: se a pessoa entrar de novo, as alterações seguem para o servidor.
      this.publish({ accessRevoked: true });
      return;
    }
    this.publish({ connection: "offline" });
    clearTimeout(this.retryTimer);
    this.retryTimer = setTimeout(() => void this.sync(), RETRY_MS);
  }

  private commit(changes: Partial<ListState>) {
    this.save();
    this.publish(changes);
  }

  private publish(changes: Partial<ListState>) {
    const view = this.queue.reduce(applyOp, this.base);
    this.state = {
      ...this.state,
      ...changes,
      items: [...view.items].sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
      customCategories: view.customCategories,
      purchases: view.purchases,
      pendingCount: this.queue.length,
    };
    for (const listener of this.listeners) listener();
  }

  private save() {
    try {
      const persisted: Persisted = { base: this.base, queue: this.queue };
      localStorage.setItem(this.storageKey, JSON.stringify(persisted));
    } catch {
      // Sem armazenamento o app continua funcionando enquanto a tela estiver aberta.
    }
  }

  private restore() {
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (!raw) return;
      const persisted = JSON.parse(raw) as Persisted;
      // Cópias salvas por versões antigas não têm todos os campos.
      this.base = { ...EMPTY, ...persisted.base };
      this.queue = persisted.queue;
    } catch {
      // Cópia local ilegível: recomeça do que vier do servidor.
    }
  }
}
