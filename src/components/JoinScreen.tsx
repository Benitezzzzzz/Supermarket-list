import { type FormEvent, useState } from "react";
import { RejectedOpError } from "../data/backend";
import { extractInvite, joinFamily } from "../data/session";
import type { SessionInfo } from "../domain/types";

interface JoinScreenProps {
  onJoined: (session: SessionInfo) => void;
  /** O acesso deste aparelho foi removido enquanto ele estava em uso. */
  revoked?: boolean;
}

/** Entrada na lista. O link pede só o nome; sem link, como no ícone do iPhone, pede os dois. */
export function JoinScreen({ onJoined, revoked = false }: JoinScreenProps) {
  const [linkInvite] = useState(() => extractInvite(location.hash));
  const [link, setLink] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [joining, setJoining] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const invite = linkInvite ?? extractInvite(link);
    if (!invite) {
      setError("Esse link não parece ser o da lista. Confira e cole de novo.");
      return;
    }
    if (!name.trim()) {
      setError("Digite seu nome.");
      return;
    }

    setJoining(true);
    setError("");
    try {
      onJoined(await joinFamily(invite, name.trim()));
    } catch (failure) {
      setError(
        failure instanceof RejectedOpError
          ? "Este link não vale mais. Peça um link novo."
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
          <p className="subtitle">
            {linkInvite ? "Bem-vindo! Como você se chama?" : "Cole o link da família para entrar."}
          </p>
        </header>
        {revoked && (
          <p className="banner banner--warning">Este aparelho não tem mais acesso à lista.</p>
        )}
        {error && (
          <p className="banner banner--danger" role="alert">
            {error}
          </p>
        )}
        <form className="form" onSubmit={(event) => void submit(event)}>
          {!linkInvite && (
            <>
              <label htmlFor="link-lista" className="field-label">
                Link da lista
              </label>
              <input
                id="link-lista"
                className="field"
                type="url"
                inputMode="url"
                placeholder="Cole aqui o link"
                autoComplete="off"
                value={link}
                onChange={(event) => setLink(event.target.value)}
              />
            </>
          )}
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
