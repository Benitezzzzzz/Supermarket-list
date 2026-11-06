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
    <div className="page">
      <header className="top">
        <h1>Lista do Mercado</h1>
        <p id="status">
          {linkInvite ? "Como você se chama?" : "Cole o link da família para entrar."}
        </p>
      </header>
      {revoked && <div className="banner">Este aparelho não tem mais acesso à lista.</div>}
      {error && <div className="banner">{error}</div>}
      <form className="join-form" onSubmit={(event) => void submit(event)}>
        {!linkInvite && (
          <input
            className="field"
            type="text"
            placeholder="Link da lista"
            aria-label="Link da lista"
            autoComplete="off"
            value={link}
            onChange={(event) => setLink(event.target.value)}
          />
        )}
        <input
          className="field"
          type="text"
          placeholder="Seu nome"
          aria-label="Seu nome"
          autoComplete="given-name"
          maxLength={40}
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <button type="submit" disabled={joining}>
          Entrar
        </button>
      </form>
    </div>
  );
}
