import { type FormEvent, useEffect, useState } from "react";
import { claimLegacy, login, MIN_PASSWORD, normalizeUsername, signup, USERNAME_PATTERN } from "../data/auth";
import { AccessRevokedError, RejectedOpError } from "../data/backend";
import type { MeResponse } from "../domain/types";
import { PasswordField } from "./PasswordField";

type Mode = "login" | "signup";

interface AuthScreenProps {
  onAuthenticated: (me: MeResponse) => void;
  /** Aparelho da versão sem contas: cria a conta levando a lista junto. */
  legacyName?: string;
  notice?: string;
  /** Nome da lista de um link de convite: depois de entrar, a pessoa cai direto nela. */
  invitedTo?: string;
}

function validate(mode: Mode | "claim", fields: { username: string; displayName: string; password: string; repeat: string }) {
  if (mode !== "login" && !fields.displayName.trim()) return "Digite seu nome.";
  if (!USERNAME_PATTERN.test(normalizeUsername(fields.username))) {
    return "O usuário precisa ter de 3 a 30 letras sem acento, números, ponto ou hífen, sem espaço.";
  }
  if (fields.password.length < MIN_PASSWORD) return `A senha precisa ter pelo menos ${MIN_PASSWORD} caracteres.`;
  if (mode !== "login" && fields.password !== fields.repeat) return "As duas senhas não estão iguais.";
  return "";
}

export function AuthScreen({ onAuthenticated, legacyName, notice, invitedTo }: AuthScreenProps) {
  // Quem já criou a conta em outro aparelho pode pular a transferência e só entrar.
  const [skipClaim, setSkipClaim] = useState(false);
  const claiming = legacyName !== undefined && !skipClaim;
  const [mode, setMode] = useState<Mode>(invitedTo ? "signup" : "login");
  const [displayName, setDisplayName] = useState(legacyName ?? "");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const effectiveMode = claiming ? "claim" : mode;

  // Quem chega por convite quase sempre ainda não tem conta.
  useEffect(() => {
    if (invitedTo) setMode("signup");
  }, [invitedTo]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const problem = validate(effectiveMode, { username, displayName, password, repeat });
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const name = displayName.trim();
      const me =
        effectiveMode === "claim"
          ? await claimLegacy(username, name, password)
          : effectiveMode === "signup"
            ? await signup(username, name, password)
            : await login(username, password);
      onAuthenticated(me);
    } catch (failure) {
      // Senha errada chega como 401 (AccessRevokedError); sem rede, como erro comum.
      setError(
        failure instanceof RejectedOpError || failure instanceof AccessRevokedError
          ? failure.message
          : "Não consegui conectar. Confira a internet e tente de novo.",
      );
      setBusy(false);
    }
  }

  const switchMode = (next: Mode) => {
    setMode(next);
    setError("");
  };
  const askName = effectiveMode !== "login";
  const submitLabel = { login: "Entrar", signup: "Criar conta", claim: "Criar minha conta" }[effectiveMode];

  return (
    <main className="app">
      <div className="page">
        <header className="screen-header">
          <h1 className="title">Lista do Mercado</h1>
          <p className="subtitle">
            {claiming
              ? `Oi, ${legacyName}! Agora cada pessoa tem usuário e senha. Crie os seus para continuar com a sua lista.`
              : invitedTo
                ? mode === "login"
                  ? "Entre com seu usuário e senha para participar."
                  : "Crie sua conta para participar. Se já tem uma, toque em Entrar."
                : mode === "login"
                  ? "Entre com seu usuário e senha."
                  : "Crie sua conta. Depois é só abrir o link de convite de uma lista, ou criar a sua."}
          </p>
        </header>

        {invitedTo && !claiming && (
          <p className="notice" role="status">
            🛒 Você recebeu um convite para a lista <strong>{invitedTo}</strong>.
          </p>
        )}

        {!claiming && (
          <div className="segmented" role="tablist" aria-label="Entrar ou criar conta">
            <button type="button" role="tab" aria-selected={mode === "login"} onClick={() => switchMode("login")}>
              Entrar
            </button>
            <button type="button" role="tab" aria-selected={mode === "signup"} onClick={() => switchMode("signup")}>
              Criar conta
            </button>
          </div>
        )}

        {notice && <p className="banner banner--warning">{notice}</p>}
        {error && (
          <p className="banner banner--danger" role="alert">
            {error}
          </p>
        )}

        <form className="form" onSubmit={(event) => void submit(event)} noValidate>
          {askName && (
            <>
              <label htmlFor="seu-nome" className="field-label">
                Seu nome
              </label>
              <input
                id="seu-nome"
                className="field"
                type="text"
                placeholder="Ex.: Maria"
                autoComplete="name"
                maxLength={40}
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
              />
            </>
          )}

          <label htmlFor="usuario" className="field-label">
            Usuário
          </label>
          <input
            id="usuario"
            className="field"
            type="text"
            placeholder="Ex.: maria"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            maxLength={30}
            value={username}
            onChange={(event) => setUsername(event.target.value)}
          />
          {askName && <p className="hint">Letras sem acento e números, sem espaço. É o que você vai usar para entrar.</p>}

          <PasswordField
            id="senha"
            label="Senha"
            value={password}
            onChange={setPassword}
            autoComplete={askName ? "new-password" : "current-password"}
          />
          {askName && (
            <PasswordField id="repetir-senha" label="Repita a senha" value={repeat} onChange={setRepeat} autoComplete="new-password" />
          )}

          <button type="submit" className="btn btn--primary btn--block btn--xl" disabled={busy}>
            {busy ? "Aguarde…" : submitLabel}
          </button>
        </form>
        {claiming && (
          <button
            type="button"
            className="btn btn--link"
            onClick={() => {
              setSkipClaim(true);
              setMode("login");
              setError("");
            }}
          >
            Já criei minha conta em outro aparelho
          </button>
        )}
      </div>
    </main>
  );
}
