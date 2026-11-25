// The home's calendar, pure: which days each view shows, how it steps, what it's called, and
// where the timed rows sit in the hour grid. The page reads the apps' rows for those days
// (week/lib/data) and lays them out with these.

import { addDays, mondayOf } from "@/features/keizoku/lib/streak";
import type { WeekData } from "@/features/week/lib/week";

export const CALENDAR_VIEWS = ["month", "week", "day", "list"] as const;
export type CalendarView = (typeof CALENDAR_VIEWS)[number];
/** What the home shows: one of the calendar's views, or the dashboard of widgets. */
export type HomeView = CalendarView | "widgets";

/** The home view last used on this device. */
export const HOME_COOKIE = "home";
export const DEFAULT_HOME: HomeView = "week";

/** The view key on the home (M, W, D, L) and its name. */
export const VIEW_KEYS: Record<CalendarView, { key: string; name: string }> = {
	month: { key: "m", name: "Month" },
	week: { key: "w", name: "Week" },
	day: { key: "d", name: "Day" },
	list: { key: "l", name: "List" },
};

/** How many days the list view runs from its first day. */
export const LIST_DAYS = 14;

const isView = (v: string | undefined): v is HomeView =>
	v === "widgets" || (CALENDAR_VIEWS as readonly string[]).includes(v ?? "");

/** The URL's view wins, then the one last used here, then the week. */
export function homeViewOf(param?: string, cookie?: string): HomeView {
	if (isView(param)) return param;
	if (isView(cookie)) return cookie;
	return DEFAULT_HOME;
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** The URL's day when it's a real date, else today. */
export function anchorOf(param: string | undefined, today: string): string {
	return param && DAY.test(param) && !Number.isNaN(Date.parse(param)) ? param : today;
}

const firstOfMonth = (iso: string) => `${iso.slice(0, 7)}-01`;

function lastOfMonth(iso: string): string {
	const [y, m] = iso.split("-").map(Number);
	return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}

/** The days a view shows around `anchor`, in order. A month runs whole weeks, Monday first. */
export function daysOf(view: CalendarView, anchor: string): string[] {
	const run = (from: string, to: string) => {
		const days: string[] = [];
		for (let d = from; d <= to; d = addDays(d, 1)) days.push(d);
		return days;
	};
	switch (view) {
		case "month": {
			const from = mondayOf(firstOfMonth(anchor));
			return run(from, addDays(mondayOf(lastOfMonth(anchor)), 6));
		}
		case "week": {
			const monday = mondayOf(anchor);
			return run(monday, addDays(monday, 6));
		}
		case "day":
			return [anchor];
		case "list":
			return run(anchor, addDays(anchor, LIST_DAYS - 1));
	}
}

/** The anchor a step back (-1) or ahead (1) lands on: a month's first, a week's Monday… */
export function stepOf(view: CalendarView, anchor: string, dir: -1 | 1): string {
	switch (view) {
		case "month": {
			const [y, m] = anchor.split("-").map(Number);
			return new Date(Date.UTC(y, m - 1 + dir, 1)).toISOString().slice(0, 10);
		}
		case "week":
			return addDays(mondayOf(anchor), 7 * dir);
		case "day":
			return addDays(anchor, dir);
		case "list":
			return addDays(anchor, LIST_DAYS * dir);
	}
}

/** Whether `today` is among the days the view shows from `anchor`. */
export const showsToday = (view: CalendarView, anchor: string, today: string) =>
	daysOf(view, anchor).includes(today) &&
	(view !== "month" || anchor.slice(0, 7) === today.slice(0, 7));

/** The home's link to a view on a day; today's is left out of the URL. */
export function hrefOf(view: HomeView, anchor?: string, today?: string): string {
	const params = new URLSearchParams({ v: view });
	if (view !== "widgets" && anchor && anchor !== today) params.set("d", anchor);
	return `/?${params}`;
}

const utc = (iso: string) => new Date(`${iso}T00:00:00Z`);
const fmt = (o: Intl.DateTimeFormatOptions) =>
	new Intl.DateTimeFormat("en-GB", { ...o, timeZone: "UTC" });
const MONTH_YEAR = fmt({ month: "long", year: "numeric" });
const DAY_MONTH = fmt({ day: "numeric", month: "long" });
const DAY_LONG = fmt({ weekday: "long", day: "numeric", month: "long" });

/** "November 2026", "23 – 29 November", "Wednesday 25 November". */
export function titleOf(view: CalendarView, anchor: string): string {
	if (view === "month") return MONTH_YEAR.format(utc(anchor));
	if (view === "day") return DAY_LONG.format(utc(anchor)).replace(",", "");
	const days = daysOf(view, anchor);
	const [first, last] = [utc(days[0]), utc(days[days.length - 1])];
	return first.getUTCMonth() === last.getUTCMonth()
		? `${first.getUTCDate()} – ${DAY_MONTH.format(last)}`
		: `${DAY_MONTH.format(first)} – ${DAY_MONTH.format(last)}`;
}

// ── The hour grid ────────────────────────────────────────────────────────────

/** A timed row without its own length takes an hour, as a calendar's new event does. */
export const DEFAULT_MINUTES = 60;

export const minutesOf = (time: string) => {
	const [h, m] = time.split(":").map(Number);
	return h * 60 + (m || 0);
};

/** The hours the grid spans: the working day, stretched to hold every timed row. */
export function hoursOf(times: string[], from = 8, to = 20): { from: number; to: number } {
	let start = from;
	let end = to;
	for (const t of times) {
		const m = minutesOf(t);
		start = Math.min(start, Math.floor(m / 60));
		end = Math.max(end, Math.min(24, Math.ceil((m + DEFAULT_MINUTES) / 60)));
	}
	return { from: start, to: end };
}

export type Placed<T> = {
	entry: T;
	/** Minutes from midnight. */
	start: number;
	end: number;
	/** Rows that overlap share the width: this one's column, of `cols`. */
	col: number;
	cols: number;
};

/** Timed rows laid side by side where they overlap, as a calendar does. */
export function placeTimed<T extends { time: string }>(entries: T[]): Placed<T>[] {
	const sorted = entries
		.map((entry) => {
			const start = minutesOf(entry.time);
			return { entry, start, end: Math.min(24 * 60, start + DEFAULT_MINUTES), col: 0, cols: 1 };
		})
		.sort((a, b) => a.start - b.start || a.end - b.end);
	const placed: Placed<T>[] = [];
	// A cluster: rows chained by overlap; they all split the same width.
	let cluster: Placed<T>[] = [];
	let clusterEnd = -1;
	const close = () => {
		const cols = Math.max(1, ...cluster.map((p) => p.col + 1));
		for (const p of cluster) p.cols = cols;
		placed.push(...cluster);
		cluster = [];
	};
	for (const row of sorted) {
		if (row.start >= clusterEnd && cluster.length > 0) close();
		const taken = new Set(cluster.filter((p) => p.end > row.start).map((p) => p.col));
		let col = 0;
		while (taken.has(col)) col++;
		row.col = col;
		cluster.push(row);
		clusterEnd = Math.max(clusterEnd, row.end);
	}
	if (cluster.length > 0) close();
	return placed;
}

// ── A day in the month ───────────────────────────────────────────────────────

export type DayFigures = {
	spent: number;
	ticks: number;
	expected: number;
	pages: number;
	km: number;
	cardsDone: number;
};

/** What a day added up to: the month's cell shows these instead of every row. */
export function figuresOf(data: WeekData, date: string): DayFigures {
	const sum = <T extends { date: string }>(rows: T[], pick: (r: T) => number) =>
		rows.reduce((acc, r) => (r.date === date ? acc + pick(r) : acc), 0);
	return {
		spent: sum(data.spent, (r) => r.amount),
		ticks: sum(data.ticks, () => 1),
		expected: sum(data.expected, (r) => r.count),
		pages: sum(data.pages, (r) => r.pages),
		km: sum(data.driven, (r) => r.km),
		cardsDone: sum(data.cardsDone, () => 1),
	};
}
