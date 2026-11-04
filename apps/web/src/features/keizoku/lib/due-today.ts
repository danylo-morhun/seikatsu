import { and, asc, db, eq, inArray, isNull, keizokuHabitLogs, keizokuHabits } from "@seikatsu/db";
import type { KeizokuHabit } from "@/features/keizoku/actions/guard";
import { isDue } from "@/features/keizoku/lib/streak";

/**
 * A workspace's habits due on `today`, whether each is done, and whether the day holds words
 * or a picture (clearing it would delete them). No session: the home card
 * passes the current workspace, the evening reminder (cron) passes each subscriber's.
 */
export async function listDueToday(
	workspaceId: string,
	today: string,
): Promise<{ habit: KeizokuHabit; done: boolean; kept: boolean; today: string }[]> {
	const habits = await db
		.select()
		.from(keizokuHabits)
		.where(and(eq(keizokuHabits.workspaceId, workspaceId), isNull(keizokuHabits.archivedAt)))
		.orderBy(asc(keizokuHabits.timeOfDay), asc(keizokuHabits.createdAt));
	const due = habits.filter((h) => isDue(h, today));
	if (due.length === 0) return [];
	const done = await db
		.select({
			habitId: keizokuHabitLogs.habitId,
			note: keizokuHabitLogs.note,
			photoUrl: keizokuHabitLogs.photoUrl,
		})
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
	const logs = new Map(done.map((d) => [d.habitId, d]));
	return due.map((habit) => {
		const log = logs.get(habit.id);
		return { habit, done: !!log, kept: !!(log?.note || log?.photoUrl), today };
	});
}
