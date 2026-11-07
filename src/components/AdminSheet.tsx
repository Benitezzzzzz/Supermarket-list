import { useCallback, useEffect, useState } from "react";
import type { AdminOverview, AdminUser } from "../../shared/contract.ts";
import { fetchOverview, logoutUser, resetPassword } from "../data/adminApi";
import type { UserInfo } from "../domain/types";
import { BottomSheet } from "../ui/BottomSheet";

interface AdminSheetProps {
  user: UserInfo;
  onClose: () => void;
}

const dateTime = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

type Action = { kind: "reset" | "logout"; target: AdminUser } | null;

/** Painel do administrador geral: todas as contas e listas. Nenhuma senha aparece aqui. */
export function AdminSheet({ user, onClose }: AdminSheetProps) {
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [error, setError] = useState("");
  const [action, setAction] = useState<Action>(null);
  const [result, setResult] = useState<{ name: string; password?: string; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setOverview(await fetchOverview());
      setError("");
    } catch {
      setError("Não consegui carregar. Confira a internet.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function confirm() {
    if (!action) return;
    setBusy(true);
    try {
      if (action.kind === "reset") {
        const password = await resetPassword(action.target);
        setResult({
          name: action.target.displayName,
          password,
          text: `Nova senha de ${action.target.displayName} (usuário ${action.target.username}):`,
        });
      } else {
        await logoutUser(action.target.id);
        setResult({ name: action.target.displayName, text: `${action.target.displayName} foi desconectado de todos os aparelhos.` });
      }
      setAction(null);
      await load();
    } catch {
      setError("Não consegui fazer agora. Confira a internet.");
    }
    setBusy(false);
  }

  return (
    <BottomSheet title="Administração geral" onClose={onClose}>
      <p className="hint">
        Você vê todas as contas e listas e pode abrir qualquer lista pelo seletor do topo. As senhas não ficam
        guardadas em lugar nenhum: se alguém esquecer, gere uma nova aqui.
      </p>

      {error && <p className="banner banner--danger" role="alert">{error}</p>}

      {result && (
        <div className="notice" role="status">
          <p className="admin__result">{result.text}</p>
          {result.password && <p className="admin__password">{result.password}</p>}
          {result.password && (
            <p className="admin__result">
              Passe para a pessoa. Ela entra com essa senha e pode trocar em Sua conta.
            </p>
          )}
        </div>
      )}

      {!overview && !error && <p className="hint">Carregando…</p>}

      {overview && (
        <>
          <h3 className="field-label">Contas · {overview.users.length}</h3>
          <ul className="members">
            {overview.users.map((account) => {
              const isMe = account.id === user.id;
              const locked = account.lockedUntil && account.lockedUntil > new Date().toISOString();
              const confirming = action?.target.id === account.id;
              return (
                <li key={account.id} className="member admin__user">
                  <span className="member__info">
                    <span className="member__name">
                      {account.displayName}
                      {account.isSuperAdmin && " · administrador geral"}
                    </span>
                    <span className="member__role">
                      {account.username}
                      {" · "}
                      {account.lastSeenAt ? `usou em ${dateTime.format(new Date(account.lastSeenAt))}` : "sem aparelho conectado"}
                      {locked && " · bloqueada por senhas erradas"}
                    </span>
                  </span>
                  {!isMe && !confirming && (
                    <span className="admin__actions">
                      <button type="button" className="btn btn--secondary btn--small" onClick={() => setAction({ kind: "reset", target: account })}>
                        Nova senha
                      </button>
                      {account.devices > 0 && (
                        <button type="button" className="btn btn--danger-soft btn--small" onClick={() => setAction({ kind: "logout", target: account })}>
                          Desconectar
                        </button>
                      )}
                    </span>
                  )}
                  {confirming && action && (
                    <span className="admin__confirm">
                      <span className="hint">
                        {action.kind === "reset"
                          ? `Gerar uma senha nova para ${account.displayName}? A atual para de funcionar.`
                          : `Desconectar ${account.displayName} de todos os aparelhos?`}
                      </span>
                      <span className="admin__actions">
                        <button type="button" className="btn btn--secondary btn--small" onClick={() => setAction(null)}>
                          Cancelar
                        </button>
                        <button type="button" className="btn btn--primary btn--small" disabled={busy} onClick={() => void confirm()}>
                          {action.kind === "reset" ? "Gerar senha" : "Desconectar"}
                        </button>
                      </span>
                    </span>
                  )}
                </li>
              );
            })}
          </ul>

          <h3 className="field-label">Listas · {overview.lists.length}</h3>
          <ul className="members">
            {overview.lists.map((list) => (
              <li key={list.id} className="member">
                <span className="member__info">
                  <span className="member__name">{list.name}</span>
                  <span className="member__role">
                    {list.items === 1 ? "1 item" : `${list.items} itens`}
                    {" · "}
                    {list.members.length === 0
                      ? "sem participantes"
                      : list.members.map((member) => `${member.displayName}${member.role === "admin" ? " (administra)" : ""}`).join(", ")}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </BottomSheet>
  );
}
