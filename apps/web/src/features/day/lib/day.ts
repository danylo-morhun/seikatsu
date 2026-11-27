// The day's rhythm: a morning that sorts what waits and picks up to three things, a day that
// works through them, an evening that logs the day and sorts what's left. Pure — the pages,
// Today and the pushes share it.

import type { DayPick } from "@seikatsu/db";
import type { QueueItem } from "@/features/home/lib/queue";
import { timeToMinutes } from "@/features/pwa/lib/schedule";
import { addDays } from "@/features/seiryu/lib/filters";

export type { DayPick };

/** A day has room for this many picks. */
export const MAX_PICKS = 3;

/** The evening starts here when no time is set. */
export const DEFAULT_EVENING = "19:00";

export const pickOf = (item: Pick<QueueItem, "key" | "title" | "href" | "app">): DayPick => ({
	key: item.key,
	title: item.title,
	href: item.href,
	app: item.app,
});

/** The Seiryu card a key names, if it names one. */
export function cardIdOf(key: string): string | null {
	return key.startsWith("seiryu:") ? key.slice("seiryu:".length) : null;
}

export type PickState = DayPick & {
	done: boolean;
	/** The row as the list has it now, with its act; null once it's gone from the list. */
	live: QueueItem | null;
};

/**
 * Whether each pick is done: ticked by hand, its card finished, or (anything else) gone from
 * the day's list — the payments are in, the applications closed. A snoozed row isn't done.
 */
export function pickStates(
	picks: DayPick[],
	{
		ticked,
		queue,
		snoozed,
		openCards,
	}: {
		ticked: string[];
		/** The day's list with snoozed rows left in (buildQueue without snoozes). */
		queue: QueueItem[];
		snoozed: string[];
		/** Picked cards still open. */
		openCards: Set<string>;
	},
): PickState[] {
	const byKey = new Map(queue.map((q) => [q.key, q]));
	return picks.map((pick) => {
		const live = byKey.get(pick.key) ?? null;
		const card = cardIdOf(pick.key);
		// The user's own words are done only when ticked.
		const gone = card
			? !openCards.has(card)
			: !pick.key.startsWith("own:") && !live && !snoozed.includes(pick.key);
		return { ...pick, done: ticked.includes(pick.key) || gone, live };
	});
}

export type Candidate = DayPick & {
	note: string;
	/** Picked yesterday and not done: offered first. */
	carried: boolean;
	/** In the week's focus and not done yet: offered right after. */
	week?: boolean;
};

/** A card from Seiryu's Focus that isn't on the list (started, no date today). */
export type FocusPick = { id: string; title: string; projectId: string; projectName: string };

/** What the morning can pick from: yesterday's leftovers, the week's focus, the list, then
 * cards under way. */
export function pickCandidates(
	queue: QueueItem[],
	focus: FocusPick[],
	carried: DayPick[],
	weekFocus: DayPick[] = [],
): Candidate[] {
	const seen = new Set<string>();
	const out: Candidate[] = [];
	const add = (c: Candidate) => {
		if (seen.has(c.key)) return;
		seen.add(c.key);
		out.push(c);
	};
	const notes = new Map(queue.map((q) => [q.key, q.note]));
	for (const pick of carried) add({ ...pick, note: notes.get(pick.key) ?? "", carried: true });
	for (const pick of weekFocus)
		add({ ...pick, note: notes.get(pick.key) ?? "", carried: false, week: true });
	// An event happens on its own time: it sits in the day's hours, it isn't one of its three.
	for (const item of queue)
		if (!item.event) add({ ...pickOf(item), note: item.note, carried: false });
	for (const card of focus)
		add({
			key: `seiryu:${card.id}`,
			title: card.title,
			href: `/seiryu/${card.projectId}/${card.id}`,
			app: "/seiryu",
			note: `${card.projectName} · in progress`,
			carried: false,
		});
	return out;
}

/** Where the day is, for Today's top: plan it, work it, close it, or it's closed. */
export type DayPhase = "plan" | "day" | "close" | "closed";

export function dayPhase(
	plan: { plannedAt: Date | null; closedAt: Date | null } | null,
	minutes: number,
	eveningTime: string = DEFAULT_EVENING,
): DayPhase {
	if (plan?.closedAt) return "closed";
	if (minutes >= timeToMinutes(eveningTime)) return "close";
	return plan?.plannedAt ? "day" : "plan";
}

/** The days "Later" offers: tomorrow, the coming Saturday, next Monday. */
export function laterDays(today: string): { tomorrow: string; weekend: string; nextWeek: string } {
	// 0 = Sunday … 6 = Saturday, read at noon UTC so no zone moves the day.
	const weekday = new Date(`${today}T12:00:00Z`).getUTCDay();
	return {
		tomorrow: addDays(today, 1),
		weekend: addDays(today, (6 - weekday + 7) % 7 || 7),
		nextWeek: addDays(today, (8 - weekday) % 7 || 7),
	};
}

export type TimelineEntry = { key: string; time: string; title: string; href: string | null };

/** Today at a time — cards due at an hour, calls — with the evening's close among them. */
export function timeline(
	items: QueueItem[],
	evening: { time: string; closed: boolean } | null,
): TimelineEntry[] {
	const timed: TimelineEntry[] = items.flatMap((i) =>
		i.time ? [{ key: i.key, time: i.time, title: i.title, href: i.href }] : [],
	);
	if (evening && !evening.closed)
		timed.push({
			key: "day:close",
			time: evening.time.slice(0, 5),
			title: "Close the day",
			href: "/evening",
		});
	return timed.sort((a, b) => a.time.localeCompare(b.time));
}

/** The evening push's line: "2 picks left · 1 habit open · 4 payments to add". */
export function closeLine({
	picks,
	habitsLeft,
	payments,
}: {
	picks: { done: number; of: number } | null;
	habitsLeft: number;
	payments: number;
}): string {
	const n = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;
	const parts = [
		picks && picks.of > picks.done && `${n(picks.of - picks.done, "pick")} left`,
		habitsLeft > 0 && `${n(habitsLeft, "habit")} open`,
		payments > 0 && `${n(payments, "payment")} to add`,
	].filter(Boolean);
	return parts.length > 0
		? `${parts.join(" · ")}. Three minutes.`
		: "Log the day and look at tomorrow.";
}

export type SlotKey = "morning" | "day" | "evening";

/** The part of the day a moment falls in: morning until noon, the evening from its time. */
export function slotOf(minutes: number, eveningTime: string = DEFAULT_EVENING): SlotKey {
	if (minutes < 12 * 60) return "morning";
	return minutes < timeToMinutes(eveningTime) ? "day" : "evening";
}

export type DaySlot<H> = {
	key: SlotKey;
	label: string;
	/** Today's times in it, in order (the evening's close heads the evening). */
	entries: TimelineEntry[];
	/** Habits done in this part of the day (Keizoku's time of day; "anytime" is the day). */
	habits: H[];
};

const SLOT_LABEL: Record<SlotKey, string> = { morning: "Morning", day: "Day", evening: "Evening" };

/** The day in three parts, each with its times and habits; empty parts are left out. */
export function daySlots<H extends { timeOfDay: "morning" | "anytime" | "evening" }>(
	entries: TimelineEntry[],
	habits: H[],
	eveningTime: string = DEFAULT_EVENING,
): DaySlot<H>[] {
	const keys: SlotKey[] = ["morning", "day", "evening"];
	return keys
		.map((key) => ({
			key,
			label: SLOT_LABEL[key],
			entries: entries.filter((e) => slotOf(timeToMinutes(e.time), eveningTime) === key),
			habits: habits.filter((h) => (h.timeOfDay === "anytime" ? "day" : h.timeOfDay) === key),
		}))
		.filter((s) => s.entries.length > 0 || s.habits.length > 0);
}
