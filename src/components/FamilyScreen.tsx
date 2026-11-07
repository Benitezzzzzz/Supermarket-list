import { useEffect, useState } from "react";
import { fetchSettings, setEntryOpen } from "../data/familyApi";
import { appLink } from "../data/session";
import { memberTone } from "../domain/categoryStyle";
import type { Member, SessionInfo } from "../domain/types";
import { useFamilyMembers } from "../hooks/useFamilyMembers";
import { ConfirmSheet } from "../ui/ConfirmSheet";

interface FamilyScreenProps {
  session: SessionInfo;
}

type Pending = { kind: "remove"; member: Member } | { kind: "close" } | null;

export function FamilyScreen({ session }: FamilyScreenProps) {
  const { members, error, remove } = useFamilyMembers();
  const [openJoin, setOpenJoin] = useState<boolean | null>(null);
  const [pending, setPending] = useState<Pending>(null);
  const [entryError, setEntryError] = useState("");
  const [copied, setCopied] = useState(false);
  const isAdmin = session.role === "admin";
  const link = appLink();

  useEffect(() => {
    fetchSettings()
      .then((settings) => setOpenJoin(settings.openJoin))
      .catch(() => setOpenJoin(null));
  }, []);

  async function changeEntry(open: boolean) {
    setPending(null);
    try {
      setOpenJoin((await setEntryOpen(open)).openJoin);
      setEntryError("");
    } catch {
      setEntryError("Não consegui mudar agora. Confira a internet e tente de novo.");
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      setEntryError("Não consegui copiar. Toque no endereço e copie manualmente.");
    }
  }

  return (
    <div className="page">
      <header className="screen-header">
        <h1 className="title">Participantes</h1>
        <p className="subtitle">Todo mundo aqui vê e edita a mesma lista.</p>
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
                    aria-label={`Remover ${member.name} da lista`}
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
          Chamar alguém
        </h2>
        <p className="hint">
          {openJoin === false
            ? "A entrada está fechada: ninguém novo consegue entrar."
            : "Mande este endereço. A pessoa abre, digita o nome e já entra."}
        </p>
        <div className="invite__row">
          <label htmlFor="link-lista" className="visually-hidden">
            Endereço da lista
          </label>
          <input
            id="link-lista"
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
        {entryError && <p className="banner banner--danger">{entryError}</p>}
        {isAdmin && openJoin !== null && (
          <button
            type="button"
            className={openJoin ? "btn btn--secondary btn--block" : "btn btn--primary btn--block"}
            onClick={() => (openJoin ? setPending({ kind: "close" }) : void changeEntry(true))}
          >
            {openJoin ? "Fechar a entrada" : "Abrir a entrada"}
          </button>
        )}
      </section>

      {pending?.kind === "remove" && (
        <ConfirmSheet
          title="Remover participante?"
          message={`${pending.member.name} deixa de ver e editar a lista.`}
          confirmLabel="Remover"
          onConfirm={() => {
            void remove(pending.member.id);
            setPending(null);
          }}
          onClose={() => setPending(null)}
        />
      )}
      {pending?.kind === "close" && (
        <ConfirmSheet
          title="Fechar a entrada?"
          message="Quem já está na lista continua. Ninguém novo consegue entrar até você abrir de novo."
          confirmLabel="Fechar entrada"
          tone="primary"
          onConfirm={() => void changeEntry(false)}
          onClose={() => setPending(null)}
        />
      )}
    </div>
  );
}
