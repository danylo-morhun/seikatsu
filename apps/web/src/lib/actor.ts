// Who a request acts for when it has no browser session: an MCP call carries an OAuth token,
// not a cookie. The MCP route verifies the token, then runs the tool inside `actAs`, and
// `auth()` (src/auth.ts) + `getUserTimeZone()` read the actor from here — so every app's own
// readers and actions, with their ownership checks, work unchanged. Only the MCP route
// ever sets it; a normal request never has an actor.

import { AsyncLocalStorage } from "node:async_hooks";

export type Actor = { userId: string; name: string | null; timeZone: string };

const store = new AsyncLocalStorage<Actor>();

export function actAs<T>(actor: Actor, run: () => Promise<T>): Promise<T> {
	return store.run(actor, run);
}

export function currentActor(): Actor | undefined {
	return store.getStore();
}
