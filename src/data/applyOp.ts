import { applyPrices, putTemplate } from "../../shared/prices.ts";
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
    case "finish": {
      const ids = new Set(op.itemIds);
      const others = snapshot.purchases.filter((purchase) => purchase.id !== op.purchase.id);
      return {
        ...snapshot,
        items: snapshot.items.filter((item) => !ids.has(item.id)),
        purchases: [op.purchase, ...others].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      };
    }
    case "updatePurchase":
      return {
        ...snapshot,
        purchases: snapshot.purchases.map((purchase) =>
          purchase.id === op.id ? { ...purchase, ...op.payment } : purchase,
        ),
      };
    case "deletePurchase":
      return { ...snapshot, purchases: snapshot.purchases.filter((purchase) => purchase.id !== op.id) };
    case "restorePurchase": {
      const others = snapshot.purchases.filter((purchase) => purchase.id !== op.purchase.id);
      return {
        ...snapshot,
        purchases: [op.purchase, ...others].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      };
    }
    case "setReceipt":
      return {
        ...snapshot,
        purchases: snapshot.purchases.map((purchase) =>
          purchase.id === op.purchaseId ? { ...purchase, receipt: op.receipt } : purchase,
        ),
      };
    case "removeReceipt":
      return {
        ...snapshot,
        purchases: snapshot.purchases.map((purchase) =>
          purchase.id === op.purchaseId ? { ...purchase, receipt: null } : purchase,
        ),
      };
    case "updatePrices":
      return {
        ...snapshot,
        purchases: snapshot.purchases.map((purchase) =>
          purchase.id === op.purchaseId
            ? {
                ...purchase,
                items: applyPrices(purchase.items, op.prices),
                amountCents: op.amountCents ?? purchase.amountCents,
              }
            : purchase,
        ),
      };
    case "upsertTemplate":
      return { ...snapshot, templates: putTemplate(snapshot.templates ?? [], op.template) };
    case "deleteTemplate":
      return { ...snapshot, templates: (snapshot.templates ?? []).filter((template) => template.id !== op.id) };
    case "addCategory": {
      const name = op.name.toLowerCase();
      if (snapshot.customCategories.some((c) => c.toLowerCase() === name)) return snapshot;
      return { ...snapshot, customCategories: [...snapshot.customCategories, op.name] };
    }
  }
}
