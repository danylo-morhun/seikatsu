import type { KeizokuHabit } from "@/features/keizoku/actions/guard";
import { isDue } from "@/features/keizoku/lib/streak";
import { and, asc, db, eq, inArray, isNull, keizokuHabitLogs, keizokuHabits } from "@seikatsu/db";

/**
 * A workspace's habits due on `today` and whether each is done. No session: the home card
 * passes the current workspace, the evening reminder (cron) passes each subscriber's.
 */
export async function listDueToday(
	workspaceId: string,
	today: string,
): Promise<{ habit: KeizokuHabit; done: boolean; today: string }[]> {
	const habits = await db
		.select()
		.from(keizokuHabits)
		.where(and(eq(keizokuHabits.workspaceId, workspaceId), isNull(keizokuHabits.archivedAt)))
		.orderBy(asc(keizokuHabits.timeOfDay), asc(keizokuHabits.createdAt));
	const due = habits.filter((h) => isDue(h, today));
	if (due.length === 0) return [];
	const done = await db
		.select({ habitId: keizokuHabitLogs.habitId })
		.from(keizokuHabitLogs)
		.where(
			and(
				inArray(
					keizokuHabitLogs.habitId,
					due.map((h) => h.id),
				),
				eq(keizokuHabitLogs.date, today),
			),
		);
	const doneIds = new Set(done.map((d) => d.habitId));
	return due.map((habit) => ({ habit, done: doneIds.has(habit.id), today }));
}
