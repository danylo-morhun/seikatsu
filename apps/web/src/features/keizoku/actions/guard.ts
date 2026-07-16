// Shared ownership guards for keizoku server actions.
// Not a "use server" module — these are helpers called inside server actions.

import { auth } from "@/auth";
import { db, eq, keizokuHabits, workspaces } from "@seikatsu/db";

export async function requireUser(): Promise<string | null> {
	const session = await auth();
	return session?.user?.id ?? null;
}

/** Returns the workspace row if it belongs to the current user, else null. */
export async function getOwnedWorkspace(workspaceId: string) {
	const userId = await requireUser();
	if (!userId) return null;
	const [ws] = await db.select().from(workspaces).where(eq(workspaces.id, workspaceId)).limit(1);
	if (!ws || ws.userId !== userId) return null;
	return ws;
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
