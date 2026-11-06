import { useState } from "react";
import { rotateInvite } from "../data/familyApi";
import { inviteLink } from "../data/session";
import type { SessionInfo } from "../domain/types";
import { useFamilyMembers } from "../hooks/useFamilyMembers";

interface FamilyPanelProps {
  session: SessionInfo;
}

export function FamilyPanel({ session }: FamilyPanelProps) {
  const { members, error, remove } = useFamilyMembers();
  const [link, setLink] = useState("");
  const [inviteError, setInviteError] = useState("");
  const [copied, setCopied] = useState(false);
  const isAdmin = session.role === "admin";

  async function createInvite() {
    const confirmed = window.confirm(
      "Gerar um link novo? O link antigo para de funcionar, mas quem já entrou continua na lista.",
    );
    if (!confirmed) return;
    try {
      setLink(inviteLink(await rotateInvite()));
      setInviteError("");
      setCopied(false);
    } catch {
      setInviteError("Não consegui gerar o link. Confira a internet.");
    }
  }

  async function copyLink() {
    await navigator.clipboard.writeText(link);
    setCopied(true);
  }

  return (
    <div className="panel">
      <h2 className="panel-title">{session.familyName}</h2>
      {error && <div className="banner">{error}</div>}
      {members && (
        <ul className="members">
          {members.map((member) => (
            <li key={member.id}>
              <span>
                {member.name}
                {member.id === session.memberId && " (você)"}
                {member.role === "admin" && " · administrador"}
              </span>
              {isAdmin && member.id !== session.memberId && (
                <button
                  type="button"
                  className="del"
                  aria-label={`Remover ${member.name} da família`}
                  onClick={() => {
                    if (window.confirm(`Remover ${member.name} da lista?`)) void remove(member.id);
                  }}
                >
                  &times;
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {isAdmin && (
        <>
          <button type="button" className="link-btn" onClick={() => void createInvite()}>
            Gerar novo link de convite
          </button>
          {inviteError && <div className="banner">{inviteError}</div>}
          {link && (
            <div className="new-cat-row">
              <input type="text" readOnly aria-label="Link de convite" value={link} />
              <button type="button" onClick={() => void copyLink()}>
                {copied ? "Copiado" : "Copiar"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
