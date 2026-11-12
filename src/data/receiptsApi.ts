import type { ReceiptReading } from "../domain/types";
import { api } from "./http";

/** Envia a foto para a leitura com IA. Não grava nada no servidor. */
export async function readReceiptPhoto(listId: string, base64: string): Promise<ReceiptReading> {
  const response = await api(`/lists/${encodeURIComponent(listId)}/receipts/read`, "POST", { image: base64 });
  return (await response.json()) as ReceiptReading;
}

/** Lê a foto de uma lista escrita à mão; devolve o texto, um item por linha. Não grava nada. */
export async function readListPhoto(listId: string, base64: string): Promise<string> {
  const response = await api(`/lists/${encodeURIComponent(listId)}/list-photo/read`, "POST", { image: base64 });
  return ((await response.json()) as { text: string }).text;
}
