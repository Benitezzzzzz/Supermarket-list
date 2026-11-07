import { createApp } from "./app.ts";
import type { Database } from "./db/database.ts";
import { durableObjectNotifier } from "./http/notifier.ts";
import { workersAiReader } from "./services/receiptReader.ts";

export { FamilyEvents } from "./http/familyEvents.ts";

interface WorkerEnv {
  DB: Database;
  FAMILY_EVENTS: DurableObjectNamespace;
  /** Workers AI: lê a foto do cupom fiscal. */
  AI?: { run(model: string, input: unknown): Promise<unknown> };
}

// O site estático é servido pela Cloudflare; o Worker só recebe /api/*.
export default {
  fetch(request: Request, env: WorkerEnv): Response | Promise<Response> {
    const reader = env.AI ? workersAiReader(env.AI) : null;
    return createApp(env.DB, durableObjectNotifier(env.FAMILY_EVENTS), reader).fetch(request);
  },
};
