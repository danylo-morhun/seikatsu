// Shared ownership guards for keizoku server actions.
// Not a "use server" module — these are helpers called inside server actions.

import { getCurrentWorkspace, isUuid } from "@/lib/session";
import { and, db, eq, keizokuHabits } from "@seikatsu/db";
import { cache } from "react";

export type KeizokuHabit = typeof keizokuHabits.$inferSelect;

/** Returns the habit row if it belongs to the current user's workspace, else null. */
export async function getOwnedHabit(habitId: string): Promise<KeizokuHabit | null> {
	// A mistyped link can't name a row (and would make Postgres throw on the uuid cast).
	if (!isUuid(habitId)) return null;
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
 * Ownership only, cached per request: the habit page loads days and notes in parallel and
 * both check the same habit. (The row isn't cached — after an edit the re-render must read
 * the updated habit.)
 */
export const isOwnedHabit = cache(
	async (habitId: string) => (await getOwnedHabit(habitId)) != null,
);

/** A day a check-in may name: a real calendar day, not after the user's today. */
export function isLoggableDay(date: string, today: string): boolean {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date > today || date < "2000-01-01") return false;
	return new Date(`${date}T00:00:00Z`).toISOString().startsWith(date);
}
