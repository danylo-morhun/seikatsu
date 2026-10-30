import { listDueToday } from "@/features/keizoku/lib/due-today";
import { mondayOf } from "@/features/keizoku/lib/streak";
import type { Notifier } from "@/features/pwa/lib/notifiers";
import { sendOnce } from "@/features/pwa/lib/push";
import { isTimeDue } from "@/features/pwa/lib/schedule";
import { and, db, gte, inArray, keizokuHabitLogs, lte } from "@seikatsu/db";

/** Evening reminder: the habits still open today, once a day at the chosen time. */
export const notifyKeizoku: Notifier = async ({ workspaceId, prefs, clock }) => {
	if (!prefs.keizokuEnabled || !isTimeDue(prefs.keizokuTime, clock)) return 0;

	const open = (await listDueToday(workspaceId, clock.day)).filter((d) => !d.done);
	// A "3 times a week" habit is on the list every day; once the week's target is met it isn't
	// open any more.
	const weekly = open.filter((d) => d.habit.frequencyType === "times_per_week");
	const doneThisWeek = new Map<string, number>();
	if (weekly.length > 0) {
		const logs = await db
			.select({ habitId: keizokuHabitLogs.habitId })
			.from(keizokuHabitLogs)
			.where(
				and(
					inArray(
						keizokuHabitLogs.habitId,
						weekly.map((d) => d.habit.id),
					),
					gte(keizokuHabitLogs.date, mondayOf(clock.day)),
					lte(keizokuHabitLogs.date, clock.day),
				),
			);
		for (const l of logs) doneThisWeek.set(l.habitId, (doneThisWeek.get(l.habitId) ?? 0) + 1);
	}
	const left = open.filter(
		({ habit }) =>
			habit.frequencyType !== "times_per_week" ||
			(doneThisWeek.get(habit.id) ?? 0) < (habit.frequencyTarget ?? 1),
	);
	if (left.length === 0) return 0;

	const names = left.map(({ habit }) => `${habit.emoji} ${habit.name}`);
	// Keyed by time too: moving the reminder later the same day sends at the new time.
	const key = `keizoku:${clock.day}:${prefs.keizokuTime.slice(0, 5)}`;
	const sent = await sendOnce(workspaceId, key, {
		title: left.length === 1 ? "One habit left today" : `${left.length} habits left today`,
		body: names.join(" · "),
		url: "/keizoku",
		tag: "keizoku-evening",
	});
	return sent ? 1 : 0;
};
