import type { Op, Snapshot } from "../domain/types";

export interface ListBackend {
  load(): Promise<Snapshot>;
  apply(op: Op): Promise<void>;
  /** Avisa quando outra pessoa mudou a lista. Retorna a função de cancelamento. */
  subscribe(onChange: () => void): () => void;
}

/** O servidor recusou a alteração; reenviar não vai adiantar. */
export class RejectedOpError extends Error {}

/** "session": a conta saiu deste aparelho. "list": a pessoa não participa mais desta lista. */
export type AccessLoss = "session" | "list";

export class AccessRevokedError extends Error {
  reason: AccessLoss;

  constructor(message: string, reason: AccessLoss) {
    super(message);
    this.reason = reason;
  }
}
