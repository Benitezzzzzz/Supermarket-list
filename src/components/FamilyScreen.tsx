import { useState } from "react";
import { rotateInvite } from "../data/familyApi";
import { inviteLink } from "../data/session";
import { memberTone } from "../domain/categoryStyle";
import type { Member, SessionInfo } from "../domain/types";
import { useFamilyMembers } from "../hooks/useFamilyMembers";
import { ConfirmSheet } from "../ui/ConfirmSheet";
import { Icon } from "../ui/Icon";

interface FamilyScreenProps {
  session: SessionInfo;
}

type Pending = { kind: "remove"; member: Member } | { kind: "invite" } | null;

export function FamilyScreen({ session }: FamilyScreenProps) {
  const { members, error, remove } = useFamilyMembers();
  const [pending, setPending] = useState<Pending>(null);
  const [link, setLink] = useState("");
  const [inviteError, setInviteError] = useState("");
  const [copied, setCopied] = useState(false);
  const isAdmin = session.role === "admin";

  async function createInvite() {
    setPending(null);
    try {
      setLink(inviteLink(await rotateInvite()));
      setInviteError("");
      setCopied(false);
    } catch {
      setInviteError("Não consegui gerar o link. Confira a internet e tente de novo.");
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      setInviteError("Não consegui copiar. Toque no link e copie manualmente.");
    }
  }

  return (
    <div className="page">
      <header className="screen-header">
        <h1 className="title">{session.familyName}</h1>
        <p className="subtitle">Quem entra pelo link vê e edita a mesma lista.</p>
      </header>

      {error && <p className="banner banner--danger">{error}</p>}
      {!members && !error && (
        <div className="skeleton" aria-hidden="true">
          <span className="skeleton__box" />
          <span className="skeleton__line" style={{ width: "60%" }} />
        </div>
      )}

      {members && (
        <ul className="members">
          {members.map((member) => {
            const isMe = member.id === session.memberId;
            return (
              <li key={member.id} className="member">
                <span className={`avatar ${memberTone(member.id)}`} aria-hidden="true">
                  {member.name.charAt(0).toUpperCase()}
                </span>
                <span className="member__info">
                  <span className="member__name">{member.name}</span>
                  <span className="member__role">
                    {member.role === "admin" ? "Administrador" : "Membro"}
                    {isMe && " · você"}
                  </span>
                </span>
                {isAdmin && !isMe && (
                  <button
                    type="button"
                    className="btn btn--danger-soft btn--small"
                    aria-label={`Remover ${member.name} da família`}
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
        <section className="invite" aria-label="Convite">
          <button
            type="button"
            className="btn btn--primary btn--block btn--xl"
            onClick={() => setPending({ kind: "invite" })}
          >
            <Icon name="link" size={22} />
            Gerar novo link de convite
          </button>
          {inviteError && <p className="banner banner--danger">{inviteError}</p>}
          {link && (
            <div className="invite__row">
              <label htmlFor="link-convite" className="visually-hidden">
                Link de convite
              </label>
              <input
                id="link-convite"
                className="field"
                type="text"
                readOnly
                value={link}
                onFocus={(event) => event.target.select()}
              />
              <button type="button" className="btn btn--secondary" onClick={() => void copyLink()}>
                {copied ? "Copiado" : "Copiar"}
              </button>
            </div>
          )}
        </section>
      )}

      {pending?.kind === "remove" && (
        <ConfirmSheet
          title="Remover da família?"
          message={`${pending.member.name} deixa de ver e editar a lista. Para voltar, vai precisar de um link novo.`}
          confirmLabel="Remover"
          onConfirm={() => {
            void remove(pending.member.id);
            setPending(null);
          }}
          onClose={() => setPending(null)}
        />
      )}
      {pending?.kind === "invite" && (
        <ConfirmSheet
          title="Gerar novo link?"
          message="O link antigo para de funcionar. Quem já entrou continua na lista."
          confirmLabel="Gerar link"
          tone="primary"
          onConfirm={() => void createInvite()}
          onClose={() => setPending(null)}
        />
      )}
    </div>
  );
}
