import type { ReceiptReading } from "../domain/types";
import { api } from "./http";

/** Envia a foto para a leitura com IA. Não grava nada no servidor. */
export async function readReceiptPhoto(listId: string, base64: string): Promise<ReceiptReading> {
  const response = await api(`/lists/${encodeURIComponent(listId)}/receipts/read`, "POST", { image: base64 });
  return (await response.json()) as ReceiptReading;
}
