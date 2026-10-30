import { describe, expect, it } from "vitest";
import {
	type PlanAccount,
	allocateFunds,
	buildPlan,
	forecastOf,
	monthBounds,
	monthProgress,
	occurrencesBetween,
	shiftMonth,
} from "./plan";

describe("month helpers", () => {
	it("bounds a month", () => {
		expect(monthBounds("2027-02")).toEqual({ from: "2027-02-01", to: "2027-02-28", days: 28 });
	});

	it("shifts across a year", () => {
		expect(shiftMonth("2026-12", 1)).toBe("2027-01");
		expect(shiftMonth("2027-01", -1)).toBe("2026-12");
	});

	it("counts the current month to today, past months whole, future months empty", () => {
		expect(monthProgress("2026-11", "2026-11-12")).toMatchObject({ elapsed: 12, days: 30 });
		expect(monthProgress("2026-10", "2026-11-12").elapsed).toBe(31);
		expect(monthProgress("2026-12", "2026-11-12").elapsed).toBe(0);
	});
});

describe("occurrencesBetween", () => {
	it("lists monthly dates inside the range", () => {
		const rec = { nextDate: "2026-11-10", endDate: null, frequency: "monthly" as const };
		expect(occurrencesBetween(rec, "2026-11-01", "2026-11-30")).toEqual(["2026-11-10"]);
		expect(occurrencesBetween(rec, "2026-12-01", "2026-12-31")).toEqual(["2026-12-10"]);
	});

	it("stops at the end date", () => {
		const rec = { nextDate: "2026-11-03", endDate: "2026-11-20", frequency: "weekly" as const };
		expect(occurrencesBetween(rec, "2026-11-01", "2026-11-30")).toEqual([
			"2026-11-03",
			"2026-11-10",
			"2026-11-17",
		]);
	});
});

describe("forecastOf", () => {
	it("ends a fixed category at spent plus still due", () => {
		expect(forecastOf({ actual: 0, upcoming: 1150, fixed: true, elapsed: 3, days: 30 })).toBe(1150);
	});

	it("says nothing about a variable one in its first week", () => {
		expect(forecastOf({ actual: 200, upcoming: 0, fixed: false, elapsed: 5, days: 30 })).toBeNull();
	});

	it("continues a variable one at its pace", () => {
		expect(forecastOf({ actual: 300, upcoming: 0, fixed: false, elapsed: 10, days: 30 })).toBe(900);
	});
});

const acc = (a: Partial<PlanAccount> & Pick<PlanAccount, "id" | "type">): PlanAccount => ({
	parentId: null,
	name: a.id,
	hidden: false,
	budget: null,
	...a,
});

describe("buildPlan", () => {
	const progress = { elapsed: 15, days: 30 };
	const empty = {
		overrides: new Map<string, number>(),
		upcomingByCategory: new Map<string, number>(),
		recurringCategories: new Set<string>(),
		progress,
	};

	it("prefers the month's override over the default", () => {
		const plan = buildPlan({
			...empty,
			accounts: [acc({ id: "clothes", type: "EXPENSE", budget: 200 })],
			balances: new Map([["clothes", 50]]),
			overrides: new Map([["clothes", 400]]),
		});
		expect(plan.expense[0]).toMatchObject({ plan: 400, overridden: true, actual: 50 });
	});

	it("counts a planned child inside its planned parent once", () => {
		const plan = buildPlan({
			...empty,
			accounts: [
				acc({ id: "food", type: "EXPENSE", budget: 1500 }),
				acc({ id: "cafes", type: "EXPENSE", parentId: "food", budget: 300 }),
			],
			// getBalances rolls children into parents.
			balances: new Map([
				["food", 700],
				["cafes", 100],
			]),
		});
		expect(plan.expense).toHaveLength(2);
		expect(plan.totals).toMatchObject({ expensePlan: 1500, expenseActual: 700 });
	});

	it("puts spending outside every plan into unplanned", () => {
		const plan = buildPlan({
			...empty,
			accounts: [
				acc({ id: "home", type: "EXPENSE" }),
				acc({ id: "rent", type: "EXPENSE", parentId: "home", budget: 1150 }),
				acc({ id: "fees", type: "EXPENSE" }),
				acc({ id: "idle", type: "EXPENSE" }),
			],
			balances: new Map([
				["home", 1230],
				["rent", 1150],
				["fees", 20],
			]),
		});
		expect(plan.unplanned).toEqual([
			{ accountId: "home", name: "home", actual: 80 },
			{ accountId: "fees", name: "fees", actual: 20 },
		]);
		expect(plan.totals.expenseActual).toBe(1250);
	});

	it("reads income as received, not as the ledger's negative", () => {
		const plan = buildPlan({
			...empty,
			accounts: [acc({ id: "salary", type: "INCOME", budget: 9950 })],
			balances: new Map([["salary", -6000]]),
		});
		expect(plan.totals).toMatchObject({ incomePlan: 9950, incomeActual: 6000 });
	});

	it("leaves hidden categories out", () => {
		const plan = buildPlan({
			...empty,
			accounts: [acc({ id: "secret", type: "EXPENSE", budget: 100, hidden: true })],
			balances: new Map([["secret", 50]]),
		});
		expect(plan.expense).toHaveLength(0);
		expect(plan.totals.expensePlan).toBe(0);
	});
});

describe("allocateFunds", () => {
	const funds = [
		{ id: "tatry", name: "Tatry", accountId: "travel", target: 3300, dueDate: "2027-02-12" },
		{ id: "ny", name: "New Year", accountId: "travel", target: 2000, dueDate: "2026-12-30" },
	];

	it("splits the target over the months left, deadline month included", () => {
		const [ny, tatry] = allocateFunds(funds, "2026-11", new Map(), new Map());
		expect(ny).toMatchObject({ id: "ny", instalment: 1000, filled: 0, onTrack: false });
		expect(tatry).toMatchObject({ id: "tatry", instalment: 825 });
	});

	it("fills the earliest deadline first and keeps the instalment once paid", () => {
		const [ny, tatry] = allocateFunds(
			funds,
			"2026-11",
			new Map([["travel", 1825]]),
			new Map([["travel", 0]]),
		);
		expect(ny).toMatchObject({ filled: 1825, instalment: 1000, onTrack: true });
		expect(tatry).toMatchObject({ filled: 0, instalment: 825, onTrack: true });
	});

	it("asks nothing once the deadline has passed", () => {
		const [ny] = allocateFunds([funds[1]], "2027-01", new Map(), new Map());
		expect(ny.instalment).toBe(0);
		expect(ny.onTrack).toBe(true);
	});
});
