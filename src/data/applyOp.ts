import type { Op, Snapshot } from "../domain/types";

export function applyOp(snapshot: Snapshot, op: Op): Snapshot {
  switch (op.kind) {
    case "upsert": {
      const changed = new Map(op.items.map((item) => [item.id, item]));
      const updated = snapshot.items.map((item) => {
        const next = changed.get(item.id);
        if (next) changed.delete(item.id);
        return next ?? item;
      });
      return { ...snapshot, items: [...updated, ...changed.values()] };
    }
    case "delete": {
      const ids = new Set(op.ids);
      return { ...snapshot, items: snapshot.items.filter((item) => !ids.has(item.id)) };
    }
    case "addCategory": {
      const name = op.name.toLowerCase();
      if (snapshot.customCategories.some((c) => c.toLowerCase() === name)) return snapshot;
      return { ...snapshot, customCategories: [...snapshot.customCategories, op.name] };
    }
  }
}
