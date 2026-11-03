// The week across the apps, Monday to Sunday: what happened on the days behind (the recap) and
// what's dated on the days ahead (the plan). Pure — the page loads each app's rows for the
// week (../data) and hands them in.

import { addDays, mondayOf } from "@/features/keizoku/lib/streak";
import type { APPS_CONFIG } from "@/lib/app-themes";

type AppHref = keyof typeof APPS_CONFIG;

/** Each app's rows that fall in the week, dated by the user's day. */
export type WeekData = {
	/** Expenses, in the base currency, summed per day. */
	spent: { date: string; amount: number }[];
	/** Habit check-ins. */
	ticks: { date: string; name: string; emoji: string }[];
	/** Habits with fixed days, and how many each day expects. */
	expected: { date: string; count: number }[];
	pages: { date: string; pages: number }[];
	/** Kilometres driven, from one odometer reading to the next. */
	driven: { date: string; km: number }[];
	cardsDone: { date: string; id: string; title: string; projectId: string }[];
	cardsDue: {
		date: string;
		id: string;
		title: string;
		projectId: string;
		projectName: string;
	}[];
	/** Applications sent, and what came back. */
	jobs: { date: string; company: string; what: JobWhat }[];
	wants: { date: string; title: string; what: WantWhat }[];
	car: { date: string; name: string }[];
	/** Recurring transactions that will post. */
	bills: { date: string; title: string; amount: number; currency: string }[];
};

export type JobWhat =
	| "applied"
	| "screening"
	| "interview"
	| "offer"
	| "rejected"
	| "withdrawn"
	| "ghosted"
	| "follow_up";
export type WantWhat = "cools" | "kept" | "bought" | "released";

export type WeekEntry = {
	key: string;
	app: AppHref;
	title: string;
	note?: string;
	href: string;
	/** A card due that day: it can move to another day of the week. */
	card?: { id: string; title: string };
};

export type WeekDay = {
	date: string;
	isToday: boolean;
	/** Before today: what happened. Today and after: what's planned (today has both). */
	past: boolean;
	done: WeekEntry[];
	plan: WeekEntry[];
};

export type WeekTotals = {
	spent: number;
	ticks: number;
	expected: number;
	pages: number;
	cardsDone: number;
	km: number;
	applied: number;
};

/** The Monday of the week holding `day`, and its seven days. */
export function weekOf(day: string): string[] {
	const monday = mondayOf(day);
	return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

const JOB_TEXT: Record<JobWhat, string> = {
	applied: "applied",
	screening: "screening",
	interview: "interview",
	offer: "offer",
	rejected: "rejected",
	withdrawn: "withdrawn",
	ghosted: "closed as ghosted",
	follow_up: "followed up",
};

const WANT_TEXT: Record<WantWhat, string> = {
	cools: "done cooling: decide",
	kept: "kept for the Plan",
	bought: "bought",
	released: "let go",
};

/** Formats an amount; no currency means the base one. */
export type Money = (amount: number, currency?: string) => string;

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

const on = <T extends { date: string }>(rows: T[], date: string) =>
	rows.filter((r) => r.date === date);

const sumOf = <T>(rows: T[], pick: (row: T) => number) => rows.reduce((acc, r) => acc + pick(r), 0);

/** Up to this many done cards get a line each; more fold into one. */
const APART = 3;

/** "Acme, Beta, Gamma and 12 more". */
function listOf(names: string[], shown = 3): string {
	const head = names.slice(0, shown).join(", ");
	return names.length > shown ? `${head} and ${names.length - shown} more` : head;
}

/** Rows grouped by what happened, in first-seen order. */
function byKind<T extends { what: string }>(rows: T[]): [T["what"], T[]][] {
	const groups = new Map<T["what"], T[]>();
	for (const row of rows) groups.set(row.what, [...(groups.get(row.what) ?? []), row]);
	return [...groups];
}

/** What happened that day, one line per app (several for cards, jobs and wants). */
function doneOn(data: WeekData, date: string, money: Money): WeekEntry[] {
	const entries: WeekEntry[] = [];
	const ticks = on(data.ticks, date);
	if (ticks.length > 0)
		entries.push({
			key: `keizoku:${date}`,
			app: "/keizoku",
			title: ticks.map((t) => `${t.emoji} ${t.name}`.trim()).join(", "),
			note: plural(ticks.length, "habit"),
			href: "/keizoku",
		});
	const cards = on(data.cardsDone, date);
	if (cards.length > APART)
		entries.push({
			key: `seiryu:done:${date}`,
			app: "/seiryu",
			title: `${cards.length} cards done`,
			note: listOf(cards.map((c) => c.title)),
			href: "/seiryu",
		});
	else
		for (const card of cards)
			entries.push({
				key: `seiryu:done:${card.id}`,
				app: "/seiryu",
				title: card.title,
				note: "done",
				href: `/seiryu/${card.projectId}/${card.id}`,
			});
	const spent = sumOf(on(data.spent, date), (r) => r.amount);
	if (spent > 0)
		entries.push({
			key: `kuroji:${date}`,
			app: "/kuroji",
			title: `${money(spent)} spent`,
			href: "/kuroji",
		});
	const pages = sumOf(on(data.pages, date), (r) => r.pages);
	if (pages > 0)
		entries.push({
			key: `tsundoku:${date}`,
			app: "/tsundoku",
			title: `${plural(pages, "page")} read`,
			href: "/tsundoku",
		});
	const km = sumOf(on(data.driven, date), (r) => r.km);
	if (km > 0)
		entries.push({
			key: `aisha:${date}`,
			app: "/aisha",
			title: `${km.toLocaleString("en-US")} km driven`,
			href: "/aisha",
		});
	// A day can close dozens of applications at once: one line per kind of event.
	for (const [what, jobs] of byKind(on(data.jobs, date)))
		entries.push(
			jobs.length === 1
				? {
						key: `kyuu:${date}:${what}`,
						app: "/kyuu",
						title: jobs[0].company,
						note: JOB_TEXT[what],
						href: "/kyuu",
					}
				: {
						key: `kyuu:${date}:${what}`,
						app: "/kyuu",
						title: `${jobs.length} ${what === "applied" ? "applications sent" : JOB_TEXT[what]}`,
						note: listOf(jobs.map((j) => j.company)),
						href: "/kyuu",
					},
		);
	for (const [what, wants] of byKind(on(data.wants, date).filter((w) => w.what !== "cools")))
		entries.push(
			wants.length === 1
				? {
						key: `hoshii:${date}:${what}`,
						app: "/hoshii",
						title: wants[0].title,
						note: WANT_TEXT[what],
						href: "/hoshii",
					}
				: {
						key: `hoshii:${date}:${what}`,
						app: "/hoshii",
						title: `${plural(wants.length, "want")} ${WANT_TEXT[what]}`,
						note: listOf(wants.map((w) => w.title)),
						href: "/hoshii",
					},
		);
	return entries;
}

/** What's dated that day ahead: cards due, the car, wants done cooling, bills. */
function planOn(data: WeekData, date: string, money: Money): WeekEntry[] {
	const entries: WeekEntry[] = [];
	for (const card of on(data.cardsDue, date))
		entries.push({
			key: `seiryu:due:${card.id}`,
			app: "/seiryu",
			title: card.title,
			note: card.projectName,
			href: `/seiryu/${card.projectId}/${card.id}`,
			card: { id: card.id, title: card.title },
		});
	for (const [i, item] of on(data.car, date).entries())
		entries.push({
			key: `aisha:due:${date}:${i}`,
			app: "/aisha",
			title: item.name,
			note: "due",
			href: "/aisha",
		});
	for (const [i, want] of on(data.wants, date)
		.filter((w) => w.what === "cools")
		.entries())
		entries.push({
			key: `hoshii:cools:${date}:${i}`,
			app: "/hoshii",
			title: want.title,
			note: WANT_TEXT.cools,
			href: "/hoshii",
		});
	for (const [i, bill] of on(data.bills, date).entries())
		entries.push({
			key: `kuroji:bill:${date}:${i}`,
			app: "/kuroji",
			title: bill.title,
			note: `${money(bill.amount, bill.currency)} · recurring`,
			href: "/kuroji",
		});
	// Habits repeat every day: they count in the week's figures, not as a line per day.
	return entries;
}

/** The week's days in order, and its totals so far. */
export function buildWeek(
	data: WeekData,
	today: string,
	week: string[],
	money: Money,
): { days: WeekDay[]; totals: WeekTotals } {
	const days = week.map((date) => {
		const past = date < today;
		// Today: what's done so far, and what's still planned.
		return {
			date,
			isToday: date === today,
			past,
			done: date <= today ? doneOn(data, date, money) : [],
			plan: past ? [] : planOn(data, date, money),
		};
	});
	const upTo = <T extends { date: string }>(rows: T[]) => rows.filter((r) => r.date <= today);
	return {
		days,
		totals: {
			spent: sumOf(upTo(data.spent), (r) => r.amount),
			ticks: upTo(data.ticks).length,
			expected: sumOf(upTo(data.expected), (r) => r.count),
			pages: sumOf(upTo(data.pages), (r) => r.pages),
			cardsDone: upTo(data.cardsDone).length,
			km: sumOf(upTo(data.driven), (r) => r.km),
			applied: upTo(data.jobs).filter((j) => j.what === "applied").length,
		},
	};
}

/** The week in one line, only what moved: "181 zł spent · 2 of 12 habits · 19 applied". */
export function weekLine(totals: WeekTotals, money: Money): string | null {
	const parts = [
		totals.spent > 0 && `${money(totals.spent)} spent`,
		totals.expected > 0 && `${totals.ticks} of ${totals.expected} habits`,
		totals.pages > 0 && `${totals.pages} pages`,
		totals.cardsDone > 0 && `${plural(totals.cardsDone, "card")} done`,
		totals.km > 0 && `${totals.km.toLocaleString("en-US")} km`,
		totals.applied > 0 && `${totals.applied} applied`,
	].filter(Boolean);
	return parts.length > 0 ? parts.join(" · ") : null;
}
