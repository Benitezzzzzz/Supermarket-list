import type { Op, Snapshot } from "../domain/types";

export interface ListBackend {
  load(): Promise<Snapshot>;
  apply(op: Op): Promise<void>;
  /** Avisa quando outra pessoa mudou a lista. Retorna a função de cancelamento. */
  subscribe(onChange: () => void): () => void;
}

/** O servidor recusou a alteração; reenviar não vai adiantar. */
export class RejectedOpError extends Error {}

/** Este aparelho não tem mais acesso à lista. */
export class AccessRevokedError extends Error {}
