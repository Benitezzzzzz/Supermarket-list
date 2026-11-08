import { type FormEvent, useState } from "react";
import { changePassword, MIN_PASSWORD } from "../data/auth";
import { RejectedOpError } from "../data/backend";
import type { UserInfo } from "../domain/types";
import { setThemeChoice, type ThemeChoice, themeChoice } from "../theme";
import { BottomSheet } from "../ui/BottomSheet";
import { Icon, type IconName } from "../ui/Icon";
import { PasswordField } from "./PasswordField";

const THEMES: { value: ThemeChoice; label: string; note: string; icon: IconName }[] = [
  { value: "auto", label: "Automático", note: "igual ao aparelho", icon: "phone" },
  { value: "light", label: "Claro", note: "sempre", icon: "sun" },
  { value: "dark", label: "Escuro", note: "sempre", icon: "moon" },
];

interface AccountSheetProps {
  user: UserInfo;
  onLogout: () => void;
  onOpenAdmin: () => void;
  onClose: () => void;
}

export function AccountSheet({ user, onLogout, onOpenAdmin, onClose }: AccountSheetProps) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [repeat, setRepeat] = useState("");
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [theme, setTheme] = useState<ThemeChoice>(themeChoice);

  function pickTheme(choice: ThemeChoice) {
    setTheme(choice);
    setThemeChoice(choice);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (next.length < MIN_PASSWORD) {
      setMessage({ kind: "error", text: `A nova senha precisa ter pelo menos ${MIN_PASSWORD} caracteres.` });
      return;
    }
    if (next !== repeat) {
      setMessage({ kind: "error", text: "As duas senhas novas não estão iguais." });
      return;
    }
    setBusy(true);
    try {
      await changePassword(user.username, current, next);
      setCurrent("");
      setNext("");
      setRepeat("");
      setMessage({ kind: "ok", text: "Senha trocada. Os outros aparelhos vão pedir a senha nova." });
    } catch (failure) {
      setMessage({
        kind: "error",
        text: failure instanceof RejectedOpError ? failure.message : "Não consegui trocar. Confira a internet.",
      });
    }
    setBusy(false);
  }

  return (
    <BottomSheet title="Sua conta" onClose={onClose}>
      <div className="summary">
        <span className="summary__amount">{user.displayName}</span>
        <span className="summary__method">Usuário: {user.username}</span>
      </div>

      <fieldset className="theme-picker">
        <legend className="field-label">Cores do app</legend>
        {THEMES.map((option) => (
          <label key={option.value} className="theme-option">
            <input
              type="radio"
              className="visually-hidden"
              name="tema"
              value={option.value}
              checked={theme === option.value}
              onChange={() => pickTheme(option.value)}
            />
            <Icon name={option.icon} size={22} />
            <span className="theme-option__label">{option.label}</span>
            <span className="theme-option__note">{option.note}</span>
          </label>
        ))}
        <p className="hint theme-picker__hint">Vale só neste aparelho.</p>
      </fieldset>

      {user.isSuperAdmin && (
        <button type="button" className="btn btn--primary btn--block" onClick={onOpenAdmin}>
          Administração geral
        </button>
      )}

      <form className="form" onSubmit={(event) => void submit(event)} noValidate>
        <h3 className="field-label">Trocar senha</h3>
        <PasswordField id="senha-atual" label="Senha atual" value={current} onChange={setCurrent} autoComplete="current-password" />
        <PasswordField id="senha-nova" label="Senha nova" value={next} onChange={setNext} autoComplete="new-password" />
        <PasswordField id="senha-repetir" label="Repita a senha nova" value={repeat} onChange={setRepeat} autoComplete="new-password" />
        {message && (
          <p className={message.kind === "ok" ? "notice" : "banner banner--danger"} role={message.kind === "ok" ? "status" : "alert"}>
            {message.text}
          </p>
        )}
        <button type="submit" className="btn btn--secondary btn--block" disabled={busy}>
          {busy ? "Aguarde…" : "Trocar senha"}
        </button>
      </form>

      <button type="button" className="btn btn--danger-soft btn--block" onClick={onLogout}>
        Sair da conta neste aparelho
      </button>
    </BottomSheet>
  );
}
