"use server";

import { getOwnedHabit, getOwnedWorkspace } from "@/features/keizoku/actions/guard";
import { localToday } from "@/features/keizoku/lib/dates";
import {
	type StreakResult,
	computeCompletionRate,
	computeStreak,
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
