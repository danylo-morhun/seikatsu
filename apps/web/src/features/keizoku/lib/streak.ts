// Pure streak/completion-rate math — no DB access, so it's easy to reason about and test.

export interface HabitSchedule {
	frequencyType: "daily" | "weekdays" | "times_per_week";
	frequencyDays: number[] | null;
	frequencyTarget: number | null;
}

export interface StreakResult {
	current: number;
	best: number;
}

function toDate(iso: string): Date {
	const [y, m, d] = iso.split("-").map(Number);
	return new Date(y, m - 1, d);
}

function toIso(d: Date): string {
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function addDays(iso: string, n: number): string {
	const d = toDate(iso);
	d.setDate(d.getDate() + n);
	return toIso(d);
}

function isScheduled(habit: HabitSchedule, dateIso: string): boolean {
	if (habit.frequencyType === "daily") return true;
	if (habit.frequencyType === "weekdays") {
		return habit.frequencyDays?.includes(toDate(dateIso).getDay()) ?? false;
	}
	return false; // times_per_week has no per-day schedule — handled separately
}

/** Monday of the week containing `dateIso` (ISO week, not JS's Sunday-start week). */
function mondayOf(dateIso: string): string {
	const d = toDate(dateIso);
	const dow = d.getDay();
	d.setDate(d.getDate() + (dow === 0 ? -6 : 1 - dow));
	return toIso(d);
}

function minDate(dates: string[]): string {
	return dates.reduce((min, d) => (d < min ? d : min), dates[0]);
}

function computeDailyStreak(habit: HabitSchedule, logDates: string[], today: string): StreakResult {
	const logged = new Set(logDates);
	if (logged.size === 0) return { current: 0, best: 0 };
	const earliest = minDate(logDates);

	let current = 0;
	let cursor = today;
	while (cursor >= earliest) {
		if (isScheduled(habit, cursor)) {
			if (logged.has(cursor)) current++;
			else if (cursor !== today) break; // today-not-yet-logged doesn't break the streak
		}
		cursor = addDays(cursor, -1);
	}

	let best = 0;
	let run = 0;
	cursor = earliest;
	while (cursor <= today) {
		if (isScheduled(habit, cursor)) {
			run = logged.has(cursor) ? run + 1 : 0;
			if (run > best) best = run;
		}
		cursor = addDays(cursor, 1);
	}

	return { current, best: Math.max(best, current) };
}

function computeWeeklyStreak(
	habit: HabitSchedule,
	logDates: string[],
	today: string,
): StreakResult {
	const target = habit.frequencyTarget ?? 1;
	if (logDates.length === 0) return { current: 0, best: 0 };

	const counts = new Map<string, number>();
	for (const d of logDates) {
		const wk = mondayOf(d);
		counts.set(wk, (counts.get(wk) ?? 0) + 1);
	}

	const currentWeek = mondayOf(today);
	const earliestWeek = mondayOf(minDate(logDates));

	let best = 0;
	let run = 0;
	let cursor = earliestWeek;
	while (cursor <= currentWeek) {
		run = (counts.get(cursor) ?? 0) >= target ? run + 1 : 0;
		if (run > best) best = run;
		cursor = addDays(cursor, 7);
	}

	let current = 0;
	cursor = currentWeek;
	while (cursor >= earliestWeek) {
		const met = (counts.get(cursor) ?? 0) >= target;
		if (met) current++;
		else if (cursor !== currentWeek) break; // in-progress current week doesn't break the streak
		cursor = addDays(cursor, -7);
	}

	return { current, best: Math.max(best, current) };
}

export function computeStreak(
	habit: HabitSchedule,
	logDates: string[],
	today: string,
): StreakResult {
	return habit.frequencyType === "times_per_week"
		? computeWeeklyStreak(habit, logDates, today)
		: computeDailyStreak(habit, logDates, today);
}

export function computeCompletionRate(
	habit: HabitSchedule,
	logDates: string[],
	from: string,
	to: string,
): number {
	if (habit.frequencyType === "times_per_week") {
		const target = habit.frequencyTarget ?? 1;
		const counts = new Map<string, number>();
		for (const d of logDates) {
			if (d < from || d > to) continue;
			const wk = mondayOf(d);
			counts.set(wk, (counts.get(wk) ?? 0) + 1);
		}
		let weeks = 0;
		let met = 0;
		let cursor = mondayOf(from);
		const lastWeek = mondayOf(to);
		while (cursor <= lastWeek) {
			weeks++;
			if ((counts.get(cursor) ?? 0) >= target) met++;
			cursor = addDays(cursor, 7);
		}
		return weeks === 0 ? 0 : Math.round((met / weeks) * 100);
	}

	const logged = new Set(logDates);
	let expected = 0;
	let done = 0;
	let cursor = from;
	while (cursor <= to) {
		if (isScheduled(habit, cursor)) {
			expected++;
			if (logged.has(cursor)) done++;
		}
		cursor = addDays(cursor, 1);
	}
	return expected === 0 ? 0 : Math.round((done / expected) * 100);
}
