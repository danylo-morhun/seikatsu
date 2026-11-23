import { describe, expect, it } from "vitest";
import { defaultSlots, layoutOf, moveSlot, stepSlot } from "@/features/home/lib/dashboard";
import { MODULE_HREFS, modulesOn } from "@/lib/modules";

const all = MODULE_HREFS;

describe("defaultSlots", () => {
	it("makes the first two apps medium and hides To do without Day", () => {
		const slots = defaultSlots(modulesOn(["/day", "/tsundoku"]));
		expect(slots.map((s) => [s.id, s.size])).toEqual([
			["/kuroji", "m"],
			["/seiryu", "m"],
			["/keizoku", "s"],
			["/kyuu", "s"],
			["/aisha", "s"],
			["/hoshii", "s"],
			["today", "l"],
		]);
		expect(slots.at(-1)?.hidden).toBe(true);
	});

	it("shows To do when Day plans around it", () => {
		expect(defaultSlots(all).at(-1)).toEqual({ id: "today", size: "l", hidden: false });
	});
});

describe("layoutOf", () => {
	it("keeps the saved order and sizes, and appends what's missing", () => {
		const slots = layoutOf(
			[
				{ id: "/seiryu", size: "l" },
				{ id: "/kuroji", size: "s", hidden: true },
			],
			modulesOn(["/tsundoku", "/keizoku", "/kyuu", "/aisha", "/hoshii", "/day"]),
		);
		expect(slots).toEqual([
			{ id: "/seiryu", size: "l", hidden: false },
			{ id: "/kuroji", size: "s", hidden: true },
			{ id: "today", size: "l", hidden: true },
		]);
	});

	it("drops unknown, repeated and switched-off widgets", () => {
		const slots = layoutOf(
			[{ id: "/nope" }, { id: "/kyuu", size: "huge" }, { id: "/kyuu" }, { id: "/aisha" }, null],
			modulesOn(["/aisha"]),
		);
		expect(slots[0]).toEqual({ id: "/kyuu", size: "s", hidden: false });
		expect(slots.filter((s) => s.id === "/kyuu")).toHaveLength(1);
		expect(slots.some((s) => s.id === "/aisha")).toBe(false);
	});

	it("falls back to the default for anything that isn't a list", () => {
		expect(layoutOf(null, all)).toEqual(defaultSlots(all));
		expect(layoutOf({ id: "/kuroji" }, all)).toEqual(defaultSlots(all));
	});
});

describe("moving", () => {
	const slots = defaultSlots(all);

	it("moves one widget to another's place", () => {
		const ids = moveSlot(slots, "/hoshii", "/kuroji").map((s) => s.id);
		expect(ids.slice(0, 3)).toEqual(["/hoshii", "/kuroji", "/seiryu"]);
	});

	it("steps over hidden widgets and stops at the ends", () => {
		const hidden = slots.map((s) => (s.id === "/seiryu" ? { ...s, hidden: true } : s));
		const ids = stepSlot(hidden, "/tsundoku", -1).map((s) => s.id);
		expect(ids.indexOf("/tsundoku")).toBeLessThan(ids.indexOf("/kuroji"));
		expect(stepSlot(slots, "/kuroji", -1)).toBe(slots);
	});
});
