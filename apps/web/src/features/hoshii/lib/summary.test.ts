import { describe, expect, it } from "vitest";
import { type SummaryItem, summaryYears, yearSummary } from "./summary";

const base: SummaryItem = {
	state: "cooling",
	addedOn: "2026-01-01",
	keptOn: null,
	boughtOn: null,
	releasedOn: null,
	skippedCooling: false,
	amount: null,
};

const items: SummaryItem[] = [
	{
		...base,
		state: "bought",
		addedOn: "2026-05-03",
		keptOn: "2026-07-02",
		boughtOn: "2026-07-14",
		amount: 1099,
	},
	{
		...base,
		state: "bought",
		addedOn: "2026-08-09",
		keptOn: "2026-09-08",
		boughtOn: "2026-09-16",
		amount: 199,
	},
	{ ...base, state: "released", addedOn: "2026-06-12", releasedOn: "2026-08-11", amount: 2899 },
	{ ...base, state: "released", addedOn: "2026-08-20", releasedOn: "2026-10-19", amount: 1799 },
	{
		...base,
		state: "plan",
		addedOn: "2026-10-01",
		keptOn: "2026-10-01",
		skippedCooling: true,
		amount: 300,
	},
	{ ...base, state: "released", addedOn: "2025-10-01", releasedOn: "2025-12-01", amount: 500 },
];

describe("yearSummary", () => {
	it("counts what was bought and let go, by month", () => {
		const y = yearSummary(items, 2026);
		expect(y.spent).toBe(1298);
		expect(y.bought).toBe(2);
		expect(y.saved).toBe(4698);
		expect(y.released).toBe(2);
		expect(y.months[6]).toEqual({ month: 6, bought: 1099, released: 0 });
		expect(y.months[9]).toEqual({ month: 9, bought: 0, released: 1799 });
		// 72 and 38 days from adding to buying.
		expect(y.averageWait).toBe(55);
	});

	it("counts decisions: kept after cooling vs let go; skipped ones apart", () => {
		const y = yearSummary(items, 2026);
		expect(y.kept).toBe(2);
		expect(y.decided).toBe(4);
		expect(y.skipped).toBe(1);
	});

	it("is empty for a quiet year", () => {
		const y = yearSummary(items, 2024);
		expect(y).toMatchObject({ spent: 0, saved: 0, averageWait: null, decided: 0 });
	});
});

describe("summaryYears", () => {
	it("lists years with activity, newest first, never the future", () => {
		expect(summaryYears(items, 2026)).toEqual([2026, 2025]);
		expect(summaryYears([], 2026)).toEqual([2026]);
	});
});
