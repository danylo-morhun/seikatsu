"use server";

import { type KeizokuHabit, isOwnedHabit } from "@/features/keizoku/actions/guard";
import {
	type StreakResult,
	type Tally,
	addDays,
	computeStreak,
	firstDay,
	isScheduled,
	rate,
	tally,
} from "@/features/keizoku/lib/streak";
import { getCurrentWorkspace } from "@/lib/session";
import { dayIn, getUserTimeZone } from "@/lib/timezone";
import { db, eq, inArray, keizokuHabitLogs, keizokuHabits } from "@seikatsu/db";

export interface HabitSummary {
	streak: StreakResult;
	/** Last 30 days, from the habit's first day; null when nothing was due. */
	rate30: number | null;
	total: number;
	start: string;
	/** The last day it counted: archived, or today. */
	end: string;
}

/** The habit page's figures: its run, its month, its total. */
export async function getHabitSummary(habit: KeizokuHabit, today: string): Promise<HabitSummary> {
	const empty = {
		streak: { current: 0, best: 0 },
		rate30: null,
		total: 0,
		start: today,
		end: today,
	};
	if (!(await isOwnedHabit(habit.id))) return empty;

	const [logs, zone] = await Promise.all([
		db
			.select({ date: keizokuHabitLogs.date })
			.from(keizokuHabitLogs)
			.where(eq(keizokuHabitLogs.habitId, habit.id)),
		getUserTimeZone(),
	]);
	const dates = logs.map((l) => l.date).filter((d) => d <= today);
	const start = firstDay(dayIn(zone, habit.createdAt), dates);
	const end = habit.archivedAt ? dayIn(zone, habit.archivedAt) : today;

	return {
		streak: computeStreak(habit, dates, end < today ? end : today),
		rate30: rate(tally(habit, dates, addDays(today, -29), today, start, end)),
		total: dates.length,
		start,
		end,
	};
}

export interface YearHabit {
	id: string;
	name: string;
	emoji: string;
	archived: boolean;
	rate: number | null;
	done: number;
	best: number;
	unit: "day" | "week";
}

export interface YearDay {
	date: string;
	/** 0 nothing done … 4 everything; null when nothing was due. */
	level: number | null;
	done: number;
	due: number;
}

export interface YearStats {
	year: number;
	/** Years with check-ins, newest first (the current one always). */
	years: number[];
	checkIns: number;
	fullDays: number;
	rate: number | null;
	bestRun: { n: number; unit: "day" | "week"; name: string } | null;
	days: YearDay[];
	months: { checkIns: number; rate: number | null }[];
	habits: YearHabit[];
}

/**
 * A year of every habit, archived ones included for the days they were active. Days are the
 * user's calendar days; a habit's days run from its first day to its archiving (or today).
 */
export async function getYearStats(year: number, today: string): Promise<YearStats> {
	const thisYear = Number(today.slice(0, 4));
	const empty: YearStats = {
		year,
		years: [thisYear],
		checkIns: 0,
		fullDays: 0,
		rate: null,
		bestRun: null,
		days: [],
		months: Array.from({ length: 12 }, () => ({ checkIns: 0, rate: null })),
		habits: [],
	};
	const ws = await getCurrentWorkspace();
	if (!ws) return empty;

	const [habits, zone] = await Promise.all([
		db.select().from(keizokuHabits).where(eq(keizokuHabits.workspaceId, ws.id)),
		getUserTimeZone(),
	]);
	if (habits.length === 0) return empty;

	const logs = await db
		.select({ habitId: keizokuHabitLogs.habitId, date: keizokuHabitLogs.date })
		.from(keizokuHabitLogs)
		.where(
			inArray(
				keizokuHabitLogs.habitId,
				habits.map((h) => h.id),
			),
		);

	const years = [...new Set([thisYear, ...logs.map((l) => Number(l.date.slice(0, 4)))])]
		.filter((y) => y <= thisYear)
		.sort((a, b) => b - a);

	const yearStart = `${year}-01-01`;
	const yearEnd = year === thisYear ? today : `${year}-12-31`;
	const datesByHabit = new Map<string, string[]>();
	for (const l of logs) {
		if (l.date > today) continue;
		const list = datesByHabit.get(l.habitId);
		if (list) list.push(l.date);
		else datesByHabit.set(l.habitId, [l.date]);
	}

	const windows = habits.map((h) => {
		const dates = datesByHabit.get(h.id) ?? [];
		return {
			habit: h,
			dates,
			inYear: new Set(dates.filter((d) => d >= yearStart && d <= yearEnd)),
			start: firstDay(dayIn(zone, h.createdAt), dates),
			end: h.archivedAt ? dayIn(zone, h.archivedAt) : today,
		};
	});

	// The year's days, each against what was due on it.
	const days = dayActivity(
		windows.map((w) => ({ ...w, checked: w.inYear })),
		yearStart,
		yearEnd,
	);
	const fullDays = days.filter((d) => d.due > 0 && d.done === d.due).length;

	const sum = (ts: Tally[]): Tally =>
		ts.reduce((a, t) => ({ done: a.done + t.done, expected: a.expected + t.expected }), {
			done: 0,
			expected: 0,
		});

	const months = Array.from({ length: 12 }, (_, m) => {
		const from = `${year}-${String(m + 1).padStart(2, "0")}-01`;
		const last = addDays(
			m === 11 ? `${year + 1}-01-01` : `${year}-${String(m + 2).padStart(2, "0")}-01`,
			-1,
		);
		const to = last < yearEnd ? last : yearEnd;
		if (from > yearEnd) return { checkIns: 0, rate: null };
		const t = sum(windows.map((w) => tally(w.habit, w.dates, from, to, w.start, w.end)));
		const checkIns = windows.reduce(
			(n, w) => n + [...w.inYear].filter((d) => d >= from && d <= to).length,
			0,
		);
		return { checkIns, rate: rate(t) };
	});

	const perHabit: YearHabit[] = windows
		.map((w) => {
			const t = tally(w.habit, w.dates, yearStart, yearEnd, w.start, w.end);
			const unit: YearHabit["unit"] = w.habit.frequencyType === "times_per_week" ? "week" : "day";
			const runEnd = w.end < yearEnd ? w.end : yearEnd;
			return {
				id: w.habit.id,
				name: w.habit.name,
				emoji: w.habit.emoji,
				archived: !!w.habit.archivedAt,
				rate: rate(t),
				done: w.inYear.size,
				best: computeStreak(w.habit, [...w.inYear], runEnd).best,
				unit,
				expected: t.expected,
			};
		})
		// Habits that weren't around this year don't belong in its ranking.
		.filter((h) => h.expected > 0 || h.done > 0)
		.sort((a, b) => (b.rate ?? -1) - (a.rate ?? -1) || b.done - a.done)
		.map(({ expected: _, ...h }) => h);

	const best = perHabit.reduce<YearHabit | null>(
		(top, h) => (!top || h.best > top.best ? h : top),
		null,
	);

	return {
		year,
		years,
		checkIns: perHabit.reduce((n, h) => n + h.done, 0),
		fullDays,
		rate: rate(
			sum(windows.map((w) => tally(w.habit, w.dates, yearStart, yearEnd, w.start, w.end))),
		),
		bestRun: best && best.best > 0 ? { n: best.best, unit: best.unit, name: best.name } : null,
		days,
		months,
		habits: perHabit,
	};
}

interface ActivityWindow {
	habit: KeizokuHabit;
	checked: Set<string>;
	start: string;
	end: string;
}

/** Each day in [from, to] against what was due on it, across every habit's active days. */
function dayActivity(windows: ActivityWindow[], from: string, to: string): YearDay[] {
	const days: YearDay[] = [];
	for (let d = from; d <= to; d = addDays(d, 1)) {
		let due = 0;
		let done = 0;
		for (const w of windows) {
			if (d < w.start || d > w.end) continue;
			const checked = w.checked.has(d);
			// A weekly target has no fixed day: a check-in counts as one due and done.
			if (isScheduled(w.habit, d)) {
				due++;
				if (checked) done++;
			} else if (checked && w.habit.frequencyType === "times_per_week") {
				due++;
				done++;
			}
		}
		const level = due === 0 ? null : done === 0 ? 0 : Math.max(1, Math.round((done / due) * 4));
		days.push({ date: d, level, done, due });
	}
	return days;
}

/** Every habit's days from `from` to today, for Today's map (archived habits for the days they ran). */
export async function getActivity(from: string, today: string): Promise<YearDay[]> {
	const ws = await getCurrentWorkspace();
	if (!ws) return [];
	const [habits, zone] = await Promise.all([
		db.select().from(keizokuHabits).where(eq(keizokuHabits.workspaceId, ws.id)),
		getUserTimeZone(),
	]);
	if (habits.length === 0) return [];
	const logs = await db
		.select({ habitId: keizokuHabitLogs.habitId, date: keizokuHabitLogs.date })
		.from(keizokuHabitLogs)
		.where(
			inArray(
				keizokuHabitLogs.habitId,
				habits.map((h) => h.id),
			),
		);
	const byHabit = new Map<string, string[]>();
	for (const l of logs) {
		if (l.date > today) continue;
		const list = byHabit.get(l.habitId);
		if (list) list.push(l.date);
		else byHabit.set(l.habitId, [l.date]);
	}
	const windows = habits.map((h) => {
		const dates = byHabit.get(h.id) ?? [];
		return {
			habit: h,
			checked: new Set(dates),
			start: firstDay(dayIn(zone, h.createdAt), dates),
			end: h.archivedAt ? dayIn(zone, h.archivedAt) : today,
		};
	});
	return dayActivity(windows, from, today);
}
