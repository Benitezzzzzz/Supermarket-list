import { createApp } from "./app.ts";
import type { Database } from "./db/database.ts";
import { durableObjectNotifier } from "./http/notifier.ts";

export { FamilyEvents } from "./http/familyEvents.ts";

interface WorkerEnv {
  DB: Database;
  FAMILY_EVENTS: DurableObjectNamespace;
}

// O site estático é servido pela Cloudflare; o Worker só recebe /api/*.
export default {
  fetch(request: Request, env: WorkerEnv): Response | Promise<Response> {
    return createApp(env.DB, durableObjectNotifier(env.FAMILY_EVENTS)).fetch(request);
  },
};
