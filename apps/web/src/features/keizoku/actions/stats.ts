"use server";

import { getOwnedHabit, getOwnedWorkspace } from "@/features/keizoku/actions/guard";
import { localToday } from "@/features/keizoku/lib/dates";
import {
	type StreakResult,
	addDays,
	computeCompletionRate,
	computeStreak,
	isScheduled,
} from "@/features/keizoku/lib/streak";
import {
	and,
	count,
	db,
	eq,
	gte,
	inArray,
	isNull,
	keizokuHabitLogs,
	keizokuHabits,
	lte,
} from "@seikatsu/db";

export async function getHabitStreaks(
	habitId: string,
	today?: string,
): Promise<StreakResult | null> {
	const habit = await getOwnedHabit(habitId);
	if (!habit) return null;

	const logs = await db
		.select({ date: keizokuHabitLogs.date })
		.from(keizokuHabitLogs)
		.where(eq(keizokuHabitLogs.habitId, habitId));

	return computeStreak(
		habit,
		logs.map((l) => l.date),
		today ?? localToday(),
	);
}

export async function getHabitCompletionRate(
	habitId: string,
	from: string,
	to: string,
): Promise<number | null> {
	const habit = await getOwnedHabit(habitId);
	if (!habit) return null;

	const logs = await db
		.select({ date: keizokuHabitLogs.date })
		.from(keizokuHabitLogs)
		.where(
			and(
				eq(keizokuHabitLogs.habitId, habitId),
				gte(keizokuHabitLogs.date, from),
				lte(keizokuHabitLogs.date, to),
			),
		);

	return computeCompletionRate(
		habit,
		logs.map((l) => l.date),
		from,
		to,
	);
}

export interface TodayProgress {
	done: number;
	total: number;
}

export async function getTodayProgress(workspaceId: string, date: string): Promise<TodayProgress> {
	const ws = await getOwnedWorkspace(workspaceId);
	if (!ws) return { done: 0, total: 0 };

	const habits = await db
		.select({ id: keizokuHabits.id })
		.from(keizokuHabits)
		.where(and(eq(keizokuHabits.workspaceId, workspaceId), isNull(keizokuHabits.archivedAt)));

	if (habits.length === 0) return { done: 0, total: 0 };

	const [row] = await db
		.select({ done: count() })
		.from(keizokuHabitLogs)
		.where(
			and(
				inArray(
					keizokuHabitLogs.habitId,
					habits.map((h) => h.id),
				),
				eq(keizokuHabitLogs.date, date),
			),
		);

	return { done: Number(row?.done ?? 0), total: habits.length };
}

export interface ActivityDay {
	date: string;
	status: "all" | "partial" | "none";
}

/** Day a habit is eligible for the required set: within [createdAt, archivedAt] so archiving never rewrites past history. */
function inActiveWindow(
	habit: { createdAt: Date; archivedAt: Date | null },
	dateIso: string,
): boolean {
	const created = habit.createdAt.toISOString().slice(0, 10);
	if (created > dateIso) return false;
	if (!habit.archivedAt) return true;
	return habit.archivedAt.toISOString().slice(0, 10) >= dateIso;
}

/**
 * Per-day all/partial/none across every habit due that day.
 * times_per_week habits have no fixed due date, so they're excluded from the
 * required set entirely — a missed weekly habit never drags a day to partial/none.
 */
export async function getActivityHeatmap(workspaceId: string, days = 371): Promise<ActivityDay[]> {
	const ws = await getOwnedWorkspace(workspaceId);
	if (!ws) return [];

	const today = localToday();
	const start = addDays(today, -(days - 1));

	const habits = await db
		.select()
		.from(keizokuHabits)
		.where(eq(keizokuHabits.workspaceId, workspaceId));
	if (habits.length === 0) return [];

	const logs = await db
		.select({ habitId: keizokuHabitLogs.habitId, date: keizokuHabitLogs.date })
		.from(keizokuHabitLogs)
		.where(
			and(
				inArray(
					keizokuHabitLogs.habitId,
					habits.map((h) => h.id),
				),
				gte(keizokuHabitLogs.date, start),
				lte(keizokuHabitLogs.date, today),
			),
		);

	const loggedSet = new Set(logs.map((l) => `${l.habitId}:${l.date}`));

	const result: ActivityDay[] = [];
	let cursor = start;
	while (cursor <= today) {
		const required = habits.filter(
			(h) =>
				h.frequencyType !== "times_per_week" && inActiveWindow(h, cursor) && isScheduled(h, cursor),
		);

		let status: ActivityDay["status"] = "none";
		if (required.length > 0) {
			const done = required.filter((h) => loggedSet.has(`${h.id}:${cursor}`)).length;
			status = done === required.length ? "all" : done > 0 ? "partial" : "none";
		}

		result.push({ date: cursor, status });
		cursor = addDays(cursor, 1);
	}

	return result;
}
