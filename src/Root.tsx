import { useEffect, useState } from "react";
import { App } from "./App";
import { JoinScreen } from "./components/JoinScreen";
import { ApiBackend } from "./data/apiBackend";
import { resumeSession } from "./data/session";
import { SyncedList } from "./data/syncedList";
import type { SessionInfo } from "./domain/types";

interface Opened {
  list: SyncedList;
  session: SessionInfo;
}

function open(session: SessionInfo): Opened {
  const storageKey = `lista-mercado:cache:${session.familyId}`;
  return { list: new SyncedList(new ApiBackend(), storageKey), session };
}

/** Tela enquanto a sessão é conferida, no lugar de uma página em branco. */
function Starting() {
  return (
    <main className="app" aria-busy="true">
      <div className="page">
        <header className="screen-header">
          <h1 className="title">Lista do Mercado</h1>
          <p className="subtitle">Abrindo…</p>
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

export function Root() {
  const [opened, setOpened] = useState<Opened | null | "resolving">("resolving");

  useEffect(() => {
    let active = true;
    void resumeSession().then((session) => {
      if (active) setOpened(session ? open(session) : null);
    });
    return () => {
      active = false;
    };
  }, []);

  const onJoined = (session: SessionInfo) => setOpened(open(session));

  if (opened === "resolving") return <Starting />;
  if (opened === null) return <JoinScreen onJoined={onJoined} />;
  return <App list={opened.list} session={opened.session} onRejoined={onJoined} />;
}
