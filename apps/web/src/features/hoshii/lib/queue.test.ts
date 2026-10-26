import { describe, expect, it } from "vitest";
import { DEFAULT_TIERS, coolingDays } from "./cooling";
import { addDays, daysBetween } from "./dates";
import { fundPlan, sortPlan, splitQueue } from "./queue";

const at = (n: number) => new Date(2026, 0, n);
const item = (
	id: string,
	state: "cooling" | "plan" | "bought" | "released",
	coolUntil: string,
	planPosition: string | null = null,
	created = 1,
) => ({ id, state, coolUntil, planPosition, createdAt: at(created) });

describe("coolingDays", () => {
	it("follows the price tiers", () => {
		expect(coolingDays(89, DEFAULT_TIERS)).toBe(7);
		expect(coolingDays(100, DEFAULT_TIERS)).toBe(30);
		expect(coolingDays(999, DEFAULT_TIERS)).toBe(30);
		expect(coolingDays(1000, DEFAULT_TIERS)).toBe(60);
	});

	it("gives an unknown price the middle tier", () => {
		expect(coolingDays(null, DEFAULT_TIERS)).toBe(30);
	});
});

describe("dates", () => {
	it("adds and counts days across months and years", () => {
		expect(addDays("2026-10-26", 30)).toBe("2026-11-25");
		expect(addDays("2026-12-30", 7)).toBe("2027-01-06");
		expect(daysBetween("2026-10-26", "2026-11-07")).toBe(12);
		expect(daysBetween("2026-11-07", "2026-10-26")).toBe(-12);
	});
});

describe("splitQueue", () => {
	it("puts cooled wants up for a decision, oldest first", () => {
		const q = splitQueue(
			[
				item("late", "cooling", "2026-10-25"),
				item("early", "cooling", "2026-10-20"),
				item("today", "cooling", "2026-10-26"),
				item("waiting", "cooling", "2026-11-07"),
				item("soon", "cooling", "2026-10-29"),
				item("gone", "released", "2026-10-01"),
			],
			"2026-10-26",
		);
		expect(q.decide.map((i) => i.id)).toEqual(["early", "late", "today"]);
		expect(q.cooling.map((i) => i.id)).toEqual(["soon", "waiting"]);
		expect(q.plan).toEqual([]);
	});

	it("keeps the Plan in its ranking, unranked ones last", () => {
		const plan = sortPlan([
			item("b", "plan", "", "a1"),
			item("new", "plan", "", null, 5),
			item("a", "plan", "", "a0"),
			item("old", "plan", "", null, 2),
		]);
		expect(plan.map((i) => i.id)).toEqual(["a", "b", "old", "new"]);
	});
});

describe("fundPlan", () => {
	it("fills the Plan top-down", () => {
		const funded = fundPlan(
			[
				{ item: "keyboard", cost: 899 },
				{ item: "lamp", cost: 749 },
				{ item: "jacket", cost: 1390 },
				{ item: "camera", cost: 7699 },
				{ item: "chair", cost: 1299 },
			],
			4820,
		);
		expect(funded.map((f) => f.funded)).toEqual([899, 749, 1390, 1782, 0]);
		expect(funded.map((f) => f.share)).toEqual([1, 1, 1, 1782 / 7699, 0]);
	});

	it("skips unknown costs and never funds from a negative balance", () => {
		const funded = fundPlan(
			[
				{ item: "unknown", cost: null },
				{ item: "next", cost: 100 },
			],
			60,
		);
		expect(funded[0]).toMatchObject({ funded: 0, share: null });
		expect(funded[1]).toMatchObject({ funded: 60, share: 0.6 });
		expect(fundPlan([{ item: "x", cost: 10 }], -50)[0].funded).toBe(0);
	});
});
