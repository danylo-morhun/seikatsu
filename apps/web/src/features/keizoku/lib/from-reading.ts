// Habits that tick themselves on a day pages are read in Tsundoku. Not a "use server" module:
// Tsundoku's actions call it inside their own (already authorized) writes.

import { and, db, eq, isNull, keizokuHabitLogs, keizokuHabits } from "@seikatsu/db";
import { revalidatePath } from "next/cache";

/**
 * Checks in, on `date`, every live habit of the workspace marked "done when I log pages".
 * A day already checked stays as it is (its note and photo kept); none is ever cleared.
 */
export async function tickReadingHabits(workspaceId: string, date: string): Promise<void> {
	const habits = await db
		.select({ id: keizokuHabits.id })
		.from(keizokuHabits)
		.where(
			and(
				eq(keizokuHabits.workspaceId, workspaceId),
				eq(keizokuHabits.fromReading, true),
				isNull(keizokuHabits.archivedAt),
			),
		);
	if (habits.length === 0) return;
	await db
		.insert(keizokuHabitLogs)
		.values(habits.map((h) => ({ habitId: h.id, date })))
		.onConflictDoNothing({ target: [keizokuHabitLogs.habitId, keizokuHabitLogs.date] });
	revalidatePath("/keizoku", "layout");
}
