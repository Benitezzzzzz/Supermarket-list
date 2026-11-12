import { useEffect, useState } from "react";
import { RejectedOpError } from "../data/backend";
import { deleteList, fetchInviteCode, leaveList, renameList, resetInviteCode } from "../data/listsApi";
import { memberTone } from "../domain/categoryStyle";
import { inviteLink, inviteMessage } from "../domain/invite";
import { shareList } from "../domain/shareList";
import type { ListMember, ListSummary, UserInfo } from "../domain/types";
import { useListMembers } from "../hooks/useListMembers";
import { ConfirmSheet } from "../ui/ConfirmSheet";
import { Icon } from "../ui/Icon";

interface ParticipantsScreenProps {
  user: UserInfo;
  list: ListSummary;
  onListsChanged: () => void;
}

type Pending =
  | { kind: "remove"; member: ListMember }
  | { kind: "delete" }
  | { kind: "leave" }
  | { kind: "new-link" }
  | null;

/** O link de convite da lista; qualquer participante pode compartilhar. */
function useInviteLink(listId: string) {
  const [code, setCode] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    setCode(null);
    setFailed(false);
    fetchInviteCode(listId)
      .then((value) => active && setCode(value))
      .catch(() => active && setFailed(true));
    return () => {
      active = false;
    };
  }, [listId]);

  return { link: code ? inviteLink(code) : null, failed, setCode };
}

export function ParticipantsScreen({ user, list, onListsChanged }: ParticipantsScreenProps) {
  const { members, error, remove } = useListMembers(list.id);
  const invite = useInviteLink(list.id);
  const [pending, setPending] = useState<Pending>(null);
  const [inviteNotice, setInviteNotice] = useState("");
  const [newName, setNewName] = useState(list.name);
  const [actionError, setActionError] = useState("");
  const [copied, setCopied] = useState(false);
  const [renamed, setRenamed] = useState("");
  const isAdmin = list.role === "admin";

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

  const message = invite.link ? inviteMessage(list.name, invite.link, user.displayName) : "";

  async function copyLink() {
    if (!invite.link) return;
    try {
      await navigator.clipboard.writeText(invite.link);
      setCopied(true);
    } catch {
      setActionError("Não consegui copiar. Toque no link e copie manualmente.");
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

      <section className="card invite" aria-labelledby="chamar">
        <h2 id="chamar" className="card__header">
          Chamar alguém para a lista
        </h2>
        <p className="hint">
          Mande o convite pelo WhatsApp. Quem tocar no link entra ou cria a conta e já cai direto na lista {list.name}.
        </p>
        {invite.failed && <p className="banner banner--danger">Não consegui carregar o link de convite. Confira a internet.</p>}
        {invite.link && (
          <>
            <div className="invite__message" role="note" aria-label="Mensagem do convite">
              {message}
            </div>
            <button type="button" className="btn btn--primary btn--block" onClick={() => void shareList(message)}>
              <Icon name="share" size={18} strokeWidth={2.4} />
              Enviar convite
            </button>
            <div className="invite__row">
              <label htmlFor="link-convite" className="visually-hidden">
                Link de convite
              </label>
              <input
                id="link-convite"
                className="field"
                type="text"
                readOnly
                value={invite.link}
                onFocus={(event) => event.target.select()}
              />
              <button type="button" className="btn btn--secondary" onClick={() => void copyLink()}>
                {copied ? "Copiado" : "Copiar link"}
              </button>
            </div>
          </>
        )}
        {isAdmin && invite.link && (
          <button type="button" className="btn btn--link" onClick={() => setPending({ kind: "new-link" })}>
            Gerar um link novo
          </button>
        )}
        <div aria-live="polite">{inviteNotice && <p className="notice">{inviteNotice}</p>}</div>
      </section>

      {isAdmin ? (
        <section className="card invite" aria-labelledby="sobre-lista">
          <h2 id="sobre-lista" className="card__header">
            Esta lista
          </h2>
          <label htmlFor="renomear-lista" className="field-label">
            Nome da lista
          </label>
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
          message={`${pending.member.displayName} deixa de ver e editar a lista ${list.name}. Para impedir que volte pelo link de convite, gere um link novo depois.`}
          confirmLabel="Remover"
          onConfirm={() => {
            void remove(pending.member.userId);
            setPending(null);
          }}
          onClose={() => setPending(null)}
        />
      )}
      {pending?.kind === "new-link" && (
        <ConfirmSheet
          title="Gerar um link novo?"
          message="O link antigo para de funcionar. Quem já participa continua na lista."
          confirmLabel="Gerar link novo"
          onConfirm={() =>
            void run(async () => {
              invite.setCode(await resetInviteCode(list.id));
              setCopied(false);
              setInviteNotice("Link novo pronto. O anterior não funciona mais.");
            })
          }
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
          message="Você deixa de ver esta lista. Para voltar, peça o link de convite de novo."
          confirmLabel="Sair da lista"
          onConfirm={() => void run(() => leaveList(list.id))}
          onClose={() => setPending(null)}
        />
      )}
    </div>
  );
}
