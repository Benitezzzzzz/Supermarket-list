import { type FormEvent, useState } from "react";
import { appLink } from "../data/auth";
import { RejectedOpError } from "../data/backend";
import { deleteList, leaveList, renameList } from "../data/listsApi";
import { memberTone } from "../domain/categoryStyle";
import type { ListMember, ListSummary, UserInfo } from "../domain/types";
import { useListMembers } from "../hooks/useListMembers";
import { ConfirmSheet } from "../ui/ConfirmSheet";

interface ParticipantsScreenProps {
  user: UserInfo;
  list: ListSummary;
  onListsChanged: () => void;
}

type Pending = { kind: "remove"; member: ListMember } | { kind: "delete" } | { kind: "leave" } | null;

export function ParticipantsScreen({ user, list, onListsChanged }: ParticipantsScreenProps) {
  const { members, error, add, remove } = useListMembers(list.id);
  const [pending, setPending] = useState<Pending>(null);
  const [username, setUsername] = useState("");
  const [addMessage, setAddMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [newName, setNewName] = useState(list.name);
  const [actionError, setActionError] = useState("");
  const [copied, setCopied] = useState(false);
  const [renamed, setRenamed] = useState("");
  const isAdmin = list.role === "admin";

  async function submitAdd(event: FormEvent) {
    event.preventDefault();
    const value = username.trim();
    if (!value) return;
    const problem = await add(value);
    setAddMessage(problem ? { kind: "error", text: problem } : { kind: "ok", text: `${value} agora participa da lista.` });
    if (!problem) setUsername("");
  }

  async function run(action: () => Promise<void>) {
    setPending(null);
    try {
      await action();
      setActionError("");
      onListsChanged();
    } catch (failure) {
      setActionError(failure instanceof RejectedOpError ? failure.message : "Não consegui agora. Confira a internet.");
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(appLink());
      setCopied(true);
    } catch {
      setActionError("Não consegui copiar. Toque no endereço e copie manualmente.");
    }
  }

  return (
    <div className="page">
      <header className="screen-header">
        <h1 className="title">Participantes</h1>
        <p className="subtitle">Quem vê e edita a lista {list.name}.</p>
      </header>

      {error && <p className="banner banner--danger">{error}</p>}
      {actionError && <p className="banner banner--danger" role="alert">{actionError}</p>}
      {!members && !error && (
        <div className="skeleton" aria-hidden="true">
          <span className="skeleton__box" />
          <span className="skeleton__line" style={{ width: "60%" }} />
        </div>
      )}

      {members && (
        <ul className="members">
          {members.map((member) => {
            const isMe = member.userId === user.id;
            return (
              <li key={member.userId} className="member">
                <span className={`avatar ${memberTone(member.userId)}`} aria-hidden="true">
                  {member.displayName.charAt(0).toUpperCase()}
                </span>
                <span className="member__info">
                  <span className="member__name">{member.displayName}</span>
                  <span className="member__role">
                    {member.username} · {member.role === "admin" ? "administra" : "participa"}
                    {isMe && " · você"}
                  </span>
                </span>
                {isAdmin && !isMe && (
                  <button
                    type="button"
                    className="btn btn--danger-soft btn--small"
                    aria-label={`Remover ${member.displayName} da lista`}
                    onClick={() => setPending({ kind: "remove", member })}
                  >
                    Remover
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {isAdmin && (
        <section className="card invite" aria-labelledby="adicionar">
          <h2 id="adicionar" className="card__header">
            Adicionar alguém
          </h2>
          <p className="hint">
            A pessoa abre o app, cria uma conta e te passa o usuário dela. Você digita aqui.
          </p>
          <form className="invite__row" onSubmit={(event) => void submitAdd(event)}>
            <label htmlFor="usuario-participante" className="visually-hidden">
              Usuário da pessoa
            </label>
            <input
              id="usuario-participante"
              className="field"
              type="text"
              placeholder="Usuário"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              value={username}
              onChange={(event) => setUsername(event.target.value)}
            />
            <button type="submit" className="btn btn--primary">
              Adicionar
            </button>
          </form>
          {addMessage && (
            <p className={addMessage.kind === "ok" ? "notice" : "banner banner--danger"} role="status">
              {addMessage.text}
            </p>
          )}
          <div className="invite__row">
            <label htmlFor="endereco-app" className="visually-hidden">
              Endereço do app
            </label>
            <input id="endereco-app" className="field" type="text" readOnly value={appLink()} onFocus={(event) => event.target.select()} />
            <button type="button" className="btn btn--secondary" onClick={() => void copyLink()}>
              {copied ? "Copiado" : "Copiar"}
            </button>
          </div>
        </section>
      )}

      {isAdmin ? (
        <section className="card invite" aria-labelledby="sobre-lista">
          <h2 id="sobre-lista" className="card__header">
            Esta lista
          </h2>
          <form
            className="invite__row"
            onSubmit={(event) => {
              event.preventDefault();
              const value = newName.trim();
              if (!value || value === list.name) return;
              setRenamed("");
              void run(async () => {
                await renameList(list.id, value);
                setRenamed(`A lista agora se chama ${value}.`);
              });
            }}
          >
            <label htmlFor="renomear-lista" className="field-label">
              Nome da lista
            </label>
            <input
              id="renomear-lista"
              className="field"
              type="text"
              maxLength={40}
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
            />
            <button type="submit" className="btn btn--secondary">
              Salvar nome
            </button>
          </form>
          <div aria-live="polite">{renamed && <p className="notice">{renamed}</p>}</div>
          <button type="button" className="btn btn--danger-soft btn--block" onClick={() => setPending({ kind: "delete" })}>
            Excluir a lista {list.name}
          </button>
        </section>
      ) : (
        <button type="button" className="btn btn--danger-soft btn--block" onClick={() => setPending({ kind: "leave" })}>
          Sair da lista {list.name}
        </button>
      )}

      {pending?.kind === "remove" && (
        <ConfirmSheet
          title="Remover participante?"
          message={`${pending.member.displayName} deixa de ver e editar a lista ${list.name}.`}
          confirmLabel="Remover"
          onConfirm={() => {
            void remove(pending.member.userId);
            setPending(null);
          }}
          onClose={() => setPending(null)}
        />
      )}
      {pending?.kind === "delete" && (
        <ConfirmSheet
          title={`Excluir a lista ${list.name}?`}
          message="Itens, gastos e participantes desta lista são apagados para todos. Não dá para desfazer."
          confirmLabel="Excluir lista"
          onConfirm={() => void run(() => deleteList(list.id))}
          onClose={() => setPending(null)}
        />
      )}
      {pending?.kind === "leave" && (
        <ConfirmSheet
          title={`Sair da lista ${list.name}?`}
          message="Você deixa de ver esta lista. Para voltar, quem administra precisa te adicionar de novo."
          confirmLabel="Sair da lista"
          onConfirm={() => void run(() => leaveList(list.id))}
          onClose={() => setPending(null)}
        />
      )}
    </div>
  );
}
