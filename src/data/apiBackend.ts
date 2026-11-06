import type { Op, Snapshot } from "../domain/types";
import type { ListBackend } from "./backend";
import { api } from "./http";

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
    }
  }

  subscribe(onChange: () => void): () => void {
    // O navegador reconecta sozinho; "ready" chega a cada conexão e cobre o que se perdeu.
    const events = new EventSource("/api/events");
    events.addEventListener("ready", onChange);
    events.addEventListener("change", onChange);
    return () => events.close();
  }
}
