import { type FormEvent, useState } from "react";
import { RejectedOpError } from "../data/backend";
import type { UserInfo } from "../domain/types";

interface CreateListScreenProps {
  user: UserInfo;
  onCreate: (name: string) => Promise<void>;
  onLogout: () => void;
}

/** Para quem ainda não participa de nenhuma lista. */
export function CreateListScreen({ user, onCreate, onLogout }: CreateListScreenProps) {
  const [name, setName] = useState("Casa");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) {
      setError("Dê um nome para a lista.");
      return;
    }
    setBusy(true);
    try {
      await onCreate(name.trim());
    } catch (failure) {
      setError(failure instanceof RejectedOpError ? failure.message : "Não consegui criar. Confira a internet.");
      setBusy(false);
    }
  }

  return (
    <main className="app">
      <div className="page">
        <header className="screen-header">
          <h1 className="title">Oi, {user.displayName.split(/\s+/)[0]}!</h1>
          <p className="subtitle">
            Você ainda não participa de nenhuma lista. Crie a sua, ou peça para alguém da família te mandar o
            link de convite da lista.
          </p>
        </header>
        {error && (
          <p className="banner banner--danger" role="alert">
            {error}
          </p>
        )}
        <form className="form" onSubmit={(event) => void submit(event)}>
          <label htmlFor="nome-lista" className="field-label">
            Nome da lista
          </label>
          <input
            id="nome-lista"
            className="field"
            type="text"
            maxLength={40}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <button type="submit" className="btn btn--primary btn--block btn--xl" disabled={busy}>
            Criar lista
          </button>
        </form>
        <button type="button" className="btn btn--link" onClick={onLogout}>
          Sair da conta
        </button>
      </div>
    </main>
  );
}
