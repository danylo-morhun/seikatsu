// Shared ownership guards for keizoku server actions.
// Not a "use server" module — these are helpers called inside server actions.

import { getCurrentWorkspace, getSessionUserId } from "@/lib/session";
import { and, db, eq, keizokuHabits } from "@seikatsu/db";
import { cache } from "react";

export { getOwnedWorkspace } from "@/lib/session";

export async function requireUser(): Promise<string | null> {
	return getSessionUserId();
}

/** Returns the habit row if it belongs to the current user's workspace, else null. */
export async function getOwnedHabit(habitId: string) {
	const ws = await getCurrentWorkspace();
	if (!ws) return null;
	const [habit] = await db
		.select()
		.from(keizokuHabits)
		.where(and(eq(keizokuHabits.id, habitId), eq(keizokuHabits.workspaceId, ws.id)))
		.limit(1);
	return habit ?? null;
}

/**
 * Ownership only, cached per request: the habit page loads logs and photos in parallel and
 * both check the same habit. (The row isn't cached — after an edit the re-render must read
 * the updated habit.)
 */
export const isOwnedHabit = cache(
	async (habitId: string) => (await getOwnedHabit(habitId)) != null,
);
