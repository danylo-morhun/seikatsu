// The week's rhythm, as the day's: a look back and up to three things in focus, planned on
// Sunday evening for the week ahead (or on any day of a week not planned yet). Pure.

import type { DayPick } from "@seikatsu/db";
import { DEFAULT_EVENING } from "@/features/day/lib/day";
import { timeToMinutes } from "@/features/pwa/lib/schedule";
import { addDays } from "@/features/seiryu/lib/filters";

/** Things a week has room for. */
export const MAX_FOCUS = 3;

/** The Monday of the week a day falls in. */
export function mondayOf(day: string): string {
	const weekday = new Date(`${day}T12:00:00Z`).getUTCDay(); // 0 = Sunday
	return addDays(day, -((weekday + 6) % 7));
}

/** The week the plan is for: on Sunday from the evening on, the next one; else this one. */
export function planTarget(today: string, minutes: number, eveningTime = DEFAULT_EVENING): string {
	const sunday = new Date(`${today}T12:00:00Z`).getUTCDay() === 0;
	const monday = mondayOf(today);
	return sunday && minutes >= timeToMinutes(eveningTime) ? addDays(monday, 7) : monday;
}

/** Whether the week that's due needs planning. */
export function weekPhase(target: { plannedAt: Date | null } | null): "plan" | "week" {
	return target?.plannedAt ? "week" : "plan";
}

export type FocusCandidate = DayPick & {
	note: string;
	/** Where it came from, shown beside it. */
	from: "carried" | "goal" | "doing" | "soon";
	/** The goal it moves, if any. */
	goal: string | null;
};

/** What the week can focus on: last week's leftovers, goals' next steps, cards under way. */
export function focusCandidates(groups: {
	carried: DayPick[];
	goalSteps: (DayPick & { goal: string; note: string })[];
	doing: (DayPick & { note: string; goal: string | null })[];
	soon: (DayPick & { note: string; goal: string | null })[];
}): FocusCandidate[] {
	const seen = new Set<string>();
	const out: FocusCandidate[] = [];
	const add = (c: FocusCandidate) => {
		if (seen.has(c.key)) return;
		seen.add(c.key);
		out.push(c);
	};
	for (const c of groups.carried)
		add({ ...c, note: "From last week", from: "carried", goal: null });
	for (const c of groups.goalSteps) add({ ...c, from: "goal" });
	for (const c of groups.doing) add({ ...c, from: "doing" });
	for (const c of groups.soon) add({ ...c, from: "soon" });
	return out;
}

export type WeekLook = {
	/** Days with a morning plan, days closed in the evening. */
	planned: number;
	closed: number;
	/** Picks done of picks made, over the days with a kept result. */
	done: number;
	of: number;
};

/** How the week's days went, from their plans. */
export function lookBack(
	days: {
		plannedAt: Date | null;
		closedAt: Date | null;
		result: { done: number; of: number } | null;
	}[],
): WeekLook {
	return days.reduce<WeekLook>(
		(acc, d) => ({
			planned: acc.planned + (d.plannedAt ? 1 : 0),
			closed: acc.closed + (d.closedAt ? 1 : 0),
			done: acc.done + (d.result?.done ?? 0),
			of: acc.of + (d.result?.of ?? 0),
		}),
		{ planned: 0, closed: 0, done: 0, of: 0 },
	);
}

/** The Seiryu project a card's link names: `/seiryu/<project>/<card>`. */
export function projectOfHref(href: string): string | null {
	const m = /^\/seiryu\/([0-9a-f-]{36})\//.exec(href);
	return m?.[1] ?? null;
}
