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

  if (opened === "resolving") return null;
  if (opened === null) return <JoinScreen onJoined={onJoined} />;
  return <App list={opened.list} session={opened.session} onRejoined={onJoined} />;
}
