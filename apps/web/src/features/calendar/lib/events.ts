// The user's own events, pure: which days a (repeating, several-day) event falls on, and the
// calendar rows it makes there.

import type { WeekEntry } from "@/features/week/lib/week";
import type { AppHref } from "@/lib/modules";

export const REPEATS = ["day", "week", "month", "year"] as const;
export type Repeat = (typeof REPEATS)[number];

/** An event as the calendar and its dialog know it. Times are "HH:MM", the user's clock. */
export type EventFields = {
	id: string;
	title: string;
	date: string;
	endDate: string | null;
	startTime: string | null;
	endTime: string | null;
	repeat: Repeat | null;
	repeatEvery: number;
	repeatUntil: string | null;
	note: string | null;
};

/** Where a calendar row comes from: an app, or the user's own event. */
export type Source = AppHref | "/calendar";

/** A row on the calendar: an app's (as Week makes them) or an event's. */
export type CalEntry = Omit<WeekEntry, "app"> & {
	app: Source;
	/** "HH:MM" the row ends at, when it has its own length. */
	end?: string;
	/** The event behind the row: it opens the event's dialog instead of a link. */
	event?: EventFields;
};

export type CalDay = {
	date: string;
	isToday: boolean;
	past: boolean;
	done: CalEntry[];
	plan: CalEntry[];
};

const toDate = (iso: string) => new Date(`${iso}T00:00:00Z`);
const toIso = (d: Date) => d.toISOString().slice(0, 10);

export function addDays(iso: string, n: number): string {
	const d = toDate(iso);
	d.setUTCDate(d.getUTCDate() + n);
	return toIso(d);
}

export const daysBetween = (from: string, to: string) =>
	Math.round((toDate(to).getTime() - toDate(from).getTime()) / 86_400_000);

/** The `n`th repeat of a start day, or null when that day doesn't exist (31 Feb, 29 Feb). */
function nth(start: string, repeat: Repeat, every: number, n: number): string | null {
	const step = every * n;
	if (repeat === "day") return addDays(start, step);
	if (repeat === "week") return addDays(start, step * 7);
	const [y, m, d] = start.split("-").map(Number);
	const months = repeat === "month" ? step : step * 12;
	const target = new Date(Date.UTC(y, m - 1 + months, d));
	// The month rolled over: that day isn't in it, so this time it's skipped.
	return target.getUTCDate() === d ? toIso(target) : null;
}

/**
 * The days an event starts on that touch `from`…`to`. A several-day event that started before
 * `from` and still runs counts; a repeat skips months without its day, as calendars do.
 */
export function startsIn(e: EventFields, from: string, to: string): string[] {
	const span = e.endDate ? Math.max(0, daysBetween(e.date, e.endDate)) : 0;
	const earliest = addDays(from, -span);
	if (!e.repeat) return e.date <= to && e.date >= earliest ? [e.date] : [];
	const every = Math.max(1, e.repeatEvery);
	const last = e.repeatUntil && e.repeatUntil < to ? e.repeatUntil : to;
	const starts: string[] = [];
	// Jump close to the range first, so a daily event from years ago costs nothing.
	let n = 0;
	if (e.repeat === "day" || e.repeat === "week") {
		const unit = (e.repeat === "day" ? 1 : 7) * every;
		n = Math.max(0, Math.floor(daysBetween(e.date, earliest) / unit));
	} else {
		const [y0, m0] = e.date.split("-").map(Number);
		const [y1, m1] = earliest.split("-").map(Number);
		const months = (y1 - y0) * 12 + (m1 - m0);
		const unit = (e.repeat === "month" ? 1 : 12) * every;
		n = Math.max(0, Math.floor(months / unit) - 1);
	}
	for (let guard = 0; guard < 1000; guard++, n++) {
		const day = nth(e.date, e.repeat, every, n);
		if (day == null) continue;
		if (day > last) break;
		if (day >= earliest) starts.push(day);
	}
	return starts;
}

const hhmm = (t: string | null) => t?.slice(0, 5) ?? null;

/** "15:00–16:30", "from 15:00", "all day", "3 days". */
export function whenOf(e: EventFields): string {
	const start = hhmm(e.startTime);
	const end = hhmm(e.endTime);
	if (e.endDate && e.endDate > e.date) {
		const days = daysBetween(e.date, e.endDate) + 1;
		return start ? `${days} days, from ${start}` : `${days} days`;
	}
	if (!start) return "all day";
	return end ? `${start}–${end}` : start;
}

const REPEAT_TEXT: Record<Repeat, [string, string]> = {
	day: ["every day", "days"],
	week: ["every week", "weeks"],
	month: ["every month", "months"],
	year: ["every year", "years"],
};

/** "every week", "every 2 months". */
export function repeatText(e: Pick<EventFields, "repeat" | "repeatEvery">): string | null {
	if (!e.repeat) return null;
	const [one, many] = REPEAT_TEXT[e.repeat];
	return e.repeatEvery > 1 ? `every ${e.repeatEvery} ${many}` : one;
}

/**
 * The rows events make on each of `days`: a one-day timed event sits at its time (with its own
 * end); an all-day or several-day one is a row on each day it covers.
 */
export function eventRows(events: EventFields[], days: string[]): Map<string, CalEntry[]> {
	const rows = new Map<string, CalEntry[]>(days.map((d) => [d, []]));
	if (days.length === 0) return rows;
	const [from, to] = [days[0], days[days.length - 1]];
	for (const e of events) {
		const span = e.endDate ? Math.max(0, daysBetween(e.date, e.endDate)) : 0;
		for (const start of startsIn(e, from, to)) {
			for (let i = 0; i <= span; i++) {
				const date = addDays(start, i);
				const list = rows.get(date);
				if (!list) continue;
				const timed = span === 0 && e.startTime;
				list.push({
					key: `event:${e.id}:${date}`,
					app: "/calendar",
					title: e.title,
					note: [span > 0 ? `day ${i + 1} of ${span + 1}` : whenOf(e), repeatText(e), e.note]
						.filter(Boolean)
						.join(" · "),
					href: `/?v=day&d=${date}`,
					time: timed ? (hhmm(e.startTime) ?? undefined) : undefined,
					end: timed ? (hhmm(e.endTime) ?? undefined) : undefined,
					event: e,
				});
			}
		}
	}
	return rows;
}

/** The calendar's days: the apps' rows with the events' put in, timed ones by their time. */
export function withEvents<D extends { date: string; plan: CalEntry[]; done: CalEntry[] }>(
	days: D[],
	rows: Map<string, CalEntry[]>,
): D[] {
	return days.map((d) => {
		const own = rows.get(d.date) ?? [];
		if (own.length === 0) return d;
		// Events lead: they're what the user set for the day themselves.
		return { ...d, plan: [...own, ...d.plan] };
	});
}
