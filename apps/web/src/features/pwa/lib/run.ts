// Offline-capable mutations: try the server action; with no connection, queue the change in
// the outbox and report success, so the UI keeps its optimistic state. OutboxSync replays it.

import type { OfflineOps, OpName, OpResult } from "@/features/pwa/lib/ops";
import { enqueue } from "@/features/pwa/lib/outbox";

export type RunResult = OpResult | { success: true; queued: true };

/** A failed fetch (no network, DNS, connection reset), not a server-side error. */
function isNetworkError(e: unknown) {
	return e instanceof TypeError || (typeof navigator !== "undefined" && !navigator.onLine);
}

export async function runOrQueue<N extends OpName>(
	name: N,
	args: OfflineOps[N],
	label: string,
	call: () => Promise<OpResult>,
): Promise<RunResult> {
	if (typeof navigator !== "undefined" && !navigator.onLine) {
		await enqueue(name, args, label);
		return { success: true, queued: true };
	}
	try {
		return await call();
	} catch (e) {
		if (!isNetworkError(e)) return { error: "Something went wrong. Try again." };
		// The action may have reached the server before the response was lost; every offline
		// op is safe to apply twice (see lib/ops.ts).
		await enqueue(name, args, label);
		return { success: true, queued: true };
	}
}

/** For actions that can't run offline (uploads, external lookups). */
export const NEEDS_CONNECTION = "You're offline. This needs a connection.";

export function offlineError(): OpResult | null {
	return typeof navigator !== "undefined" && !navigator.onLine ? { error: NEEDS_CONNECTION } : null;
}
