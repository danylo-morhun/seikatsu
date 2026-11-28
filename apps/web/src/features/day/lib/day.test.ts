import { describe, expect, it } from "vitest";
import type { QueueItem } from "@/features/home/lib/queue";
import {
	closeLine,
	dayPhase,
	daySlots,
	laterDays,
	pickCandidates,
	pickStates,
	slotOf,
	staleOf,
	timeline,
} from "./day";

const item = (key: string, extra: Partial<QueueItem> = {}): QueueItem => ({
	key,
	app: "/kuroji",
	title: key,
	note: `note ${key}`,
	href: "/kuroji",
	tone: "due",
	act: { kind: "open" },
	...extra,
});

const pick = (key: string) => ({ key, title: key, href: "/", app: "/kuroji" });

describe("pickStates", () => {
	const base = { ticked: [], queue: [], snoozed: [], openCards: new Set<string>() };

	it("is done when ticked, or gone from the list", () => {
		const states = pickStates([pick("a"), pick("b"), pick("c")], {
			...base,
			ticked: ["a"],
			queue: [item("a"), item("b")],
		});
		expect(states.map((s) => [s.key, s.done, s.live?.key ?? null])).toEqual([
			["a", true, "a"],
			["b", false, "b"],
			["c", true, null],
		]);
	});

	it("isn't done while snoozed", () => {
		expect(pickStates([pick("a")], { ...base, snoozed: ["a"] })[0]?.done).toBe(false);
	});

	it("reads a card by whether it's still open, on the list or not", () => {
		const states = pickStates([pick("seiryu:1"), pick("seiryu:2")], {
			...base,
			openCards: new Set(["1"]),
		});
		expect(states.map((s) => s.done)).toEqual([false, true]);
	});
});

describe("pickCandidates", () => {
	it("offers yesterday's first, then the list, then cards under way, each once", () => {
		const out = pickCandidates(
			[item("a"), item("seiryu:1")],
			[
				{ id: "1", title: "Card 1", projectId: "p", projectName: "Home" },
				{ id: "2", title: "Card 2", projectId: "p", projectName: "Home" },
			],
			[pick("a")],
		);
		expect(out.map((c) => [c.key, c.carried, c.note])).toEqual([
			["a", true, "note a"],
			["seiryu:1", false, "note seiryu:1"],
			["seiryu:2", false, "Home · in progress"],
		]);
	});
});

describe("dayPhase", () => {
	const at = (h: number) => h * 60;
	it("plans, works, closes", () => {
		expect(dayPhase(null, at(8))).toBe("plan");
		expect(dayPhase({ plannedAt: new Date(), closedAt: null }, at(11))).toBe("day");
		expect(dayPhase({ plannedAt: new Date(), closedAt: null }, at(19))).toBe("close");
		expect(dayPhase(null, at(20), "21:00")).toBe("plan");
		expect(dayPhase({ plannedAt: null, closedAt: new Date() }, at(22))).toBe("closed");
	});
});

describe("laterDays", () => {
	it("goes to the coming Saturday and next Monday", () => {
		// Wednesday
		expect(laterDays("2026-11-18")).toEqual({
			tomorrow: "2026-11-19",
			weekend: "2026-11-21",
			nextWeek: "2026-11-23",
		});
		// Saturday: the next one, a week on
		expect(laterDays("2026-11-21").weekend).toBe("2026-11-28");
		// Sunday: Monday is next week
		expect(laterDays("2026-11-22").nextWeek).toBe("2026-11-23");
	});
});

describe("timeline", () => {
	it("lists today's times in order, with the evening's close", () => {
		const out = timeline([item("b", { time: "20:00" }), item("x"), item("a", { time: "09:00" })], {
			time: "19:00:00",
			closed: false,
		});
		expect(out.map((e) => [e.time, e.key])).toEqual([
			["09:00", "a"],
			["19:00", "day:close"],
			["20:00", "b"],
		]);
		expect(timeline([], { time: "19:00", closed: true })).toEqual([]);
	});
});

describe("closeLine", () => {
	it("says what the evening has to sort", () => {
		expect(closeLine({ picks: { done: 1, of: 3 }, habitsLeft: 1, payments: 4 })).toBe(
			"2 picks left · 1 habit open · 4 payments to add. Three minutes.",
		);
		expect(closeLine({ picks: { done: 3, of: 3 }, habitsLeft: 0, payments: 0 })).toBe(
			"Log the day and look at tomorrow.",
		);
	});
});

describe("daySlots", () => {
	it("puts times and habits in their part of the day", () => {
		const entries = timeline(
			[item("a", { time: "09:00" }), item("b", { time: "13:00" }), item("c", { time: "20:00" })],
			{ time: "19:00", closed: false },
		);
		const habits = [
			{ id: "gym", timeOfDay: "anytime" as const },
			{ id: "read", timeOfDay: "evening" as const },
		];
		const slots = daySlots(entries, habits, "19:00");
		expect(
			slots.map((s) => [s.key, s.entries.map((e) => e.key), s.habits.map((h) => h.id)]),
		).toEqual([
			["morning", ["a"], []],
			["day", ["b"], ["gym"]],
			["evening", ["day:close", "c"], ["read"]],
		]);
		expect(daySlots([], [], "19:00")).toEqual([]);
	});

	it("reads the part of the day from the clock", () => {
		expect([slotOf(600), slotOf(720), slotOf(1140, "19:00")]).toEqual([
			"morning",
			"day",
			"evening",
		]);
	});
});

describe("pickCandidates with the week's focus", () => {
	it("offers the focus right after yesterday's leftovers", () => {
		const out = pickCandidates([item("a"), item("w")], [], [pick("y")], [pick("w")]);
		expect(out.map((c) => [c.key, c.carried, c.week ?? false])).toEqual([
			["y", true, false],
			["w", false, true],
			["a", false, false],
		]);
	});
});

describe("staleOf", () => {
	const card = (key: string, late?: number) => item(key, { cardId: key, late });
	it("gathers cards long late when there are two or more", () => {
		const items = [card("a", 5), card("b", 3), card("c", 1), card("d"), item("e", { late: 9 })];
		expect(staleOf(items).map((i) => i.key)).toEqual(["a", "b"]);
	});
	it("leaves a single long-late card to its own row", () => {
		expect(staleOf([card("a", 5), card("b", 1)])).toEqual([]);
	});
});
