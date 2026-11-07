import { type FormEvent, useState } from "react";
import { RejectedOpError } from "../data/backend";
import { extractInvite, joinFamily } from "../data/session";
import type { SessionInfo } from "../domain/types";

interface JoinScreenProps {
  onJoined: (session: SessionInfo) => void;
  /** O acesso deste aparelho foi removido enquanto ele estava em uso. */
  revoked?: boolean;
}

/** Entrada na lista: só o nome. */
export function JoinScreen({ onJoined, revoked = false }: JoinScreenProps) {
  const [invite] = useState(() => extractInvite(location.hash));
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [joining, setJoining] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) {
      setError("Digite seu nome.");
      return;
    }

    setJoining(true);
    setError("");
    try {
      onJoined(await joinFamily(name.trim(), invite));
    } catch (failure) {
      setError(
        failure instanceof RejectedOpError
          ? failure.message
          : "Não consegui conectar. Confira a internet e tente de novo.",
      );
      setJoining(false);
    }
  }

  return (
    <main className="app">
      <div className="page">
        <header className="screen-header">
          <h1 className="title">Lista do Mercado</h1>
          <p className="subtitle">Bem-vindo! Como você se chama?</p>
        </header>
        {revoked && (
          <p className="banner banner--warning">Este aparelho saiu da lista. Para voltar, entre de novo.</p>
        )}
        {error && (
          <p className="banner banner--danger" role="alert">
            {error}
          </p>
        )}
        <form className="form" onSubmit={(event) => void submit(event)}>
          <label htmlFor="seu-nome" className="field-label">
            Seu nome
          </label>
          <input
            id="seu-nome"
            className="field"
            type="text"
            placeholder="Ex.: Maria"
            autoComplete="given-name"
            maxLength={40}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <button type="submit" className="btn btn--primary btn--block btn--xl" disabled={joining}>
            {joining ? "Entrando…" : "Entrar"}
          </button>
        </form>
      </div>
    </main>
  );
}
