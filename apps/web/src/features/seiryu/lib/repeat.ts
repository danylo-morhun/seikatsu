// Repeating cards: finishing one makes the next, due one step later. Pure.

export type RepeatUnit = "day" | "week" | "month" | "year";

export interface Repeat {
	every: number;
	unit: RepeatUnit;
	/** Count from the day it's done (a haircut) instead of keeping the calendar (rent). */
	fromDone: boolean;
}

export const REPEAT_PRESETS: { every: number; unit: RepeatUnit }[] = [
	{ every: 1, unit: "day" },
	{ every: 1, unit: "week" },
	{ every: 2, unit: "week" },
	{ every: 1, unit: "month" },
	{ every: 3, unit: "month" },
	{ every: 1, unit: "year" },
];

/** "Every day", "Every 2 weeks". */
export function repeatLabel(every: number, unit: RepeatUnit): string {
	return every === 1 ? `Every ${unit}` : `Every ${every} ${unit}s`;
}

/** `day` plus `n` units; a month step keeps to the month's last day (31 Jan → 28 Feb). */
export function addUnits(day: string, n: number, unit: RepeatUnit): string {
	const [y = 1970, m = 1, d = 1] = day.split("-").map(Number);
	if (unit === "day" || unit === "week") {
		const at = new Date(Date.UTC(y, m - 1, d + n * (unit === "week" ? 7 : 1)));
		return at.toISOString().slice(0, 10);
	}
	const months = m - 1 + n * (unit === "year" ? 12 : 1);
	const year = y + Math.floor(months / 12);
	const month = ((months % 12) + 12) % 12;
	const last = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
	return new Date(Date.UTC(year, month, Math.min(d, last))).toISOString().slice(0, 10);
}

/**
 * The next card's due date. From the due date it keeps the rhythm (the 6th stays the 6th) and
 * skips steps already behind the day it's done; from done, or with no date, it counts from then.
 */
export function nextDueDate(rule: Repeat, dueDate: string | null, doneDay: string): string {
	const base = rule.fromDone || !dueDate ? doneDay : dueDate;
	let step = 1;
	let next = addUnits(base, rule.every * step, rule.unit);
	while (next <= doneDay && base !== doneDay) {
		step++;
		next = addUnits(base, rule.every * step, rule.unit);
	}
	return next;
}
