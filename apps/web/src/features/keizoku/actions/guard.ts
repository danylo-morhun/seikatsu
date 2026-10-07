// Shared ownership guards for keizoku server actions.
// Not a "use server" module — these are helpers called inside server actions.

import { getSessionUserId } from "@/lib/session";
import { db, eq, keizokuHabits, workspaces } from "@seikatsu/db";

export { getOwnedWorkspace } from "@/lib/session";

export async function requireUser(): Promise<string | null> {
	return getSessionUserId();
}

/** Returns the habit row if it belongs to the current user's workspace, else null. */
export async function getOwnedHabit(habitId: string) {
	const userId = await requireUser();
	if (!userId) return null;
	const [row] = await db
		.select({ habit: keizokuHabits, ownerId: workspaces.userId })
		.from(keizokuHabits)
		.innerJoin(workspaces, eq(keizokuHabits.workspaceId, workspaces.id))
		.where(eq(keizokuHabits.id, habitId))
		.limit(1);
	if (!row || row.ownerId !== userId) return null;
	return row.habit;
}
