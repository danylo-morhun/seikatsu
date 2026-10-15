// Pure habit math on calendar days (YYYY-MM-DD strings) — no DB access, so it's easy to test.
// A habit's days run from its first day (created, or the earliest check-in when it was
// back-filled before that) to today; days before it are never "missed".

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
	return new Date(Date.UTC(y, m - 1, d));
}

function toIso(d: Date): string {
	return d.toISOString().slice(0, 10);
}

/** `iso` moved by `n` days. Pure calendar math in UTC, so no time zone or DST can skew it. */
export function addDays(iso: string, n: number): string {
	const d = toDate(iso);
	d.setUTCDate(d.getUTCDate() + n);
	return toIso(d);
}

/** 0 = Sunday … 6 = Saturday, as `frequencyDays` stores them. */
export function weekday(iso: string): number {
	return toDate(iso).getUTCDay();
}

/** Whether the habit is due on a fixed day; `times_per_week` habits have no fixed days. */
export function isScheduled(habit: HabitSchedule, dateIso: string): boolean {
	if (habit.frequencyType === "daily") return true;
	if (habit.frequencyType === "weekdays")
		return habit.frequencyDays?.includes(weekday(dateIso)) ?? false;
	return false;
}

/** Whether the habit belongs on that day's list: a weekly target can be met on any day. */
export function isDue(habit: HabitSchedule, dateIso: string): boolean {
	return habit.frequencyType === "times_per_week" || isScheduled(habit, dateIso);
}

/** Monday of the week containing `dateIso` (ISO week). */
export function mondayOf(dateIso: string): string {
	const dow = weekday(dateIso);
	return addDays(dateIso, dow === 0 ? -6 : 1 - dow);
}

function minDate(dates: string[]): string {
	return dates.reduce((min, d) => (d < min ? d : min), dates[0]);
}

/** The habit's first day: when it was created, or its earliest check-in if that came first. */
export function firstDay(createdDay: string, logDates: string[]): string {
	return logDates.length > 0 ? minDate([createdDay, ...logDates]) : createdDay;
}

function computeDailyStreak(habit: HabitSchedule, logDates: string[], today: string): StreakResult {
	const logged = new Set(logDates.filter((d) => d <= today));
	if (logged.size === 0) return { current: 0, best: 0 };
	const earliest = minDate([...logged]);

	let current = 0;
	let cursor = today;
	while (cursor >= earliest) {
		if (isScheduled(habit, cursor)) {
			if (logged.has(cursor)) current++;
			else if (cursor !== today) break; // today-not-yet-logged doesn't break the run
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
	const dates = logDates.filter((d) => d <= today);
	if (dates.length === 0) return { current: 0, best: 0 };

	const counts = weekCounts(dates);
	const currentWeek = mondayOf(today);
	const earliestWeek = mondayOf(minDate(dates));

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
		else if (cursor !== currentWeek) break; // the week in progress doesn't break the run
		cursor = addDays(cursor, -7);
	}

	return { current, best: Math.max(best, current) };
}

function weekCounts(dates: string[]): Map<string, number> {
	const counts = new Map<string, number>();
	for (const d of dates) {
		const wk = mondayOf(d);
		counts.set(wk, (counts.get(wk) ?? 0) + 1);
	}
	return counts;
}

/** The run in progress and the longest one: scheduled days for daily habits, weeks for targets. */
export function computeStreak(
	habit: HabitSchedule,
	logDates: string[],
	today: string,
): StreakResult {
	return habit.frequencyType === "times_per_week"
		? computeWeeklyStreak(habit, logDates, today)
		: computeDailyStreak(habit, logDates, today);
}

/** What a run is counted in. */
export function runUnit(habit: HabitSchedule, n: number): string {
	const unit = habit.frequencyType === "times_per_week" ? "week" : "day";
	return n === 1 ? unit : `${unit}s`;
}

export interface Tally {
	done: number;
	expected: number;
}

/**
 * Check-ins against what was due in [from, to], clipped to the habit's days (`start`, and
 * `end` for an archived habit). A weekly target counts per ISO week: whole weeks inside the
 * range expect the target, the week still in progress expects no more than is left of it.
 */
export function tally(
	habit: HabitSchedule,
	logDates: string[],
	from: string,
	to: string,
	start: string,
	end?: string | null,
): Tally {
	const lo = from > start ? from : start;
	const hi = end && end < to ? end : to;
	if (lo > hi) return { done: 0, expected: 0 };
	const inRange = logDates.filter((d) => d >= lo && d <= hi);

	if (habit.frequencyType === "times_per_week") {
		const target = habit.frequencyTarget ?? 1;
		const counts = weekCounts(inRange);
		let done = 0;
		let expected = 0;
		for (let wk = mondayOf(lo); wk <= hi; wk = addDays(wk, 7)) {
			const first = wk < lo ? lo : wk;
			const last = addDays(wk, 6) > hi ? hi : addDays(wk, 6);
			const days = (toDate(last).getTime() - toDate(first).getTime()) / 86_400_000 + 1;
			const want = Math.min(target, days);
			expected += want;
			done += Math.min(counts.get(wk) ?? 0, want);
		}
		return { done, expected };
	}

	const logged = new Set(inRange);
	let done = 0;
	let expected = 0;
	for (let d = lo; d <= hi; d = addDays(d, 1)) {
		// An extra check-in off-schedule is kept, but never counts past what was due.
		if (isScheduled(habit, d)) {
			expected++;
			if (logged.has(d)) done++;
		}
	}
	return { done, expected };
}

/** Done as a whole percent of due, or null when nothing was due. */
export function rate({ done, expected }: Tally): number | null {
	return expected === 0 ? null : Math.round((done / expected) * 100);
}

/** The `n` days ending with `today`, oldest first. */
export function lastDays(today: string, n: number): string[] {
	return Array.from({ length: n }, (_, i) => addDays(today, i - (n - 1)));
}

/** Check-ins in the ISO week of `today`, for "2 of 3 this week". */
export function thisWeek(logDates: string[], today: string): number {
	const monday = mondayOf(today);
	return logDates.filter((d) => d >= monday && d <= today).length;
}
