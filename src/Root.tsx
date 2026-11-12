import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { App } from "./App";
import { AuthScreen } from "./components/AuthScreen";
import { CreateListScreen } from "./components/CreateListScreen";
import { fetchMe, forgetEverything, logout, type MeState, preferredListId, setPreferredListId } from "./data/auth";
import { ApiBackend } from "./data/apiBackend";
import { RejectedOpError } from "./data/backend";
import { createList, joinInvite, previewInvite, renameList } from "./data/listsApi";
import { SyncedList } from "./data/syncedList";
import type { ListSummary, MeResponse } from "./domain/types";
import { clearInvite, pendingInvite } from "./invite";

/** Tela enquanto a conta é conferida, no lugar de uma página em branco. */
function Starting({ message = "Abrindo…" }: { message?: string }) {
  return (
    <main className="app" aria-busy="true">
      <div className="page">
        <header className="screen-header">
          <h1 className="title">Lista do Mercado</h1>
          <p className="subtitle">{message}</p>
        </header>
        {[70, 50, 85].map((width) => (
          <div key={width} className="skeleton" aria-hidden="true">
            <span className="skeleton__box" />
            <span className="skeleton__line" style={{ width: `${width}%` }} />
          </div>
        ))}
      </div>
    </main>
  );
}

/** A lista preferida, se a pessoa ainda participa dela; senão, a primeira. */
function pickList(lists: ListSummary[], wanted: string | null): string | null {
  if (wanted && lists.some((list) => list.id === wanted)) return wanted;
  return lists[0]?.id ?? null;
}

export function Root() {
  const [state, setState] = useState<MeState | "loading">("loading");
  const [listId, setListId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  /** Convite aberto por link (/convite/<código>), esperando a pessoa entrar na conta. */
  const [invite, setInvite] = useState<{ code: string; listName?: string } | null>(() => {
    const code = pendingInvite();
    return code ? { code } : null;
  });
  const joining = useRef(false);

  const applyMe = useCallback((me: MeResponse, wanted: string | null = preferredListId()) => {
    setState({ kind: "user", me });
    const chosen = pickList(me.lists, wanted);
    setListId(chosen);
    if (chosen) setPreferredListId(chosen);
  }, []);

  const refresh = useCallback(
    async (wanted?: string | null) => {
      const next = await fetchMe();
      if (next.kind === "user") applyMe(next.me, wanted);
      else setState(next);
    },
    [applyMe],
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const inviteCode = invite?.code;
  const dropInvite = useCallback((message: string) => {
    clearInvite();
    setInvite(null);
    setNotice(message);
  }, []);

  // O nome da lista do convite aparece na tela de entrar, antes de ter conta.
  useEffect(() => {
    if (!inviteCode) return;
    let active = true;
    previewInvite(inviteCode)
      .then(({ listName }) => {
        if (active) setInvite((current) => (current?.code === inviteCode ? { code: inviteCode, listName } : current));
      })
      .catch((failure) => {
        if (active && failure instanceof RejectedOpError) dropInvite(failure.message);
      });
    return () => {
      active = false;
    };
  }, [inviteCode, dropInvite]);

  // Com a conta aberta, entra na lista do convite e já abre nela.
  const signedIn = state !== "loading" && state.kind === "user";
  useEffect(() => {
    if (!signedIn || !inviteCode || joining.current) return;
    joining.current = true;
    joinInvite(inviteCode)
      .then(async (joined) => {
        clearInvite();
        setInvite(null);
        setNotice(`Pronto! Você está na lista ${joined.name}.`);
        await refresh(joined.id);
      })
      .catch((failure) => {
        dropInvite(
          failure instanceof RejectedOpError
            ? failure.message
            : "Não consegui entrar na lista do convite agora. Abra o link de novo com internet.",
        );
      })
      .finally(() => {
        joining.current = false;
      });
  }, [signedIn, inviteCode, refresh, dropInvite]);

  const list = useMemo(
    () => (listId ? new SyncedList(new ApiBackend(listId), `lista-mercado:cache:${listId}`) : null),
    [listId],
  );

  const onSessionLost = useCallback(() => {
    forgetEverything();
    setNotice("Sua conta saiu deste aparelho. Entre de novo.");
    setState({ kind: "none" });
  }, []);

  const onListLost = useCallback(() => {
    setNotice("Você não participa mais daquela lista.");
    void refresh(null);
  }, [refresh]);

  const onLogout = useCallback(async () => {
    await logout().catch(() => {});
    setNotice("");
    setState({ kind: "none" });
    setListId(null);
  }, []);

  const onCreateList = useCallback(
    async (name: string) => {
      const created = await createList(name);
      await refresh(created.id);
    },
    [refresh],
  );

  if (state === "loading") return <Starting />;
  if (state.kind === "none") {
    return <AuthScreen notice={notice} invitedTo={invite?.listName} onAuthenticated={(me) => applyMe(me)} />;
  }
  if (state.kind === "legacy") return <AuthScreen legacyName={state.name} onAuthenticated={(me) => applyMe(me)} />;

  if (invite) return <Starting message={invite.listName ? `Entrando na lista ${invite.listName}…` : "Entrando na lista…"} />;

  const { me } = state;
  const current = me.lists.find((item) => item.id === listId);
  if (!list || !current) return <CreateListScreen user={me.user} onCreate={onCreateList} onLogout={() => void onLogout()} />;

  return (
    <App
      key={current.id}
      list={list}
      user={me.user}
      current={current}
      lists={me.lists}
      notice={notice}
      onSwitchList={(id) => {
        setNotice("");
        setPreferredListId(id);
        setListId(id);
      }}
      onCreateList={onCreateList}
      onRenameList={async (id, name) => {
        await renameList(id, name);
        await refresh(listId);
      }}
      onListsChanged={() => void refresh(listId)}
      onLogout={() => void onLogout()}
      onSessionLost={onSessionLost}
      onListLost={onListLost}
    />
  );
}
