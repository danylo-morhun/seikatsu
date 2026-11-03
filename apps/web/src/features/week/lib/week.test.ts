import { describe, expect, it } from "vitest";
import { buildWeek, type WeekData, weekOf } from "./week";

const TODAY = "2026-11-04"; // a Wednesday
const WEEK = weekOf(TODAY);
const money = (n: number, c = "PLN") => `${n} ${c}`;

const empty: WeekData = {
	spent: [],
	ticks: [],
	expected: [],
	pages: [],
	driven: [],
	cardsDone: [],
	cardsDue: [],
	jobs: [],
	wants: [],
	car: [],
	bills: [],
};

describe("weekOf", () => {
	it("runs Monday to Sunday, whatever day it's asked from", () => {
		expect(weekOf(TODAY)).toEqual([
			"2026-11-02",
			"2026-11-03",
			"2026-11-04",
			"2026-11-05",
			"2026-11-06",
			"2026-11-07",
			"2026-11-08",
		]);
		expect(weekOf("2026-11-08")[0]).toBe("2026-11-02");
	});
});

describe("buildWeek", () => {
	const data: WeekData = {
		...empty,
		spent: [
			{ date: "2026-11-02", amount: 30 },
			{ date: "2026-11-02", amount: 15 },
		],
		ticks: [
			{ date: "2026-11-02", name: "Gym", emoji: "💪" },
			{ date: "2026-11-02", name: "Reading", emoji: "📚" },
		],
		expected: [
			{ date: "2026-11-02", count: 3 },
			{ date: "2026-11-05", count: 2 },
		],
		pages: [{ date: "2026-11-03", pages: 20 }],
		cardsDone: [{ date: "2026-11-03", id: "c1", title: "Merge PRs", projectId: "p" }],
		cardsDue: [
			{
				date: "2026-11-05",
				id: "c2",
				title: "Call the garage",
				projectId: "p",
				projectName: "Home",
			},
		],
		jobs: [
			{ date: "2026-11-02", company: "Acme", what: "applied" },
			{ date: "2026-11-06", company: "Later", what: "applied" },
		],
		wants: [
			{ date: "2026-11-06", title: "Kindle", what: "cools" },
			{ date: "2026-11-03", title: "Hat", what: "released" },
		],
		bills: [{ date: "2026-11-07", title: "Rent", amount: 2400, currency: "PLN" }],
	};
	const { days, totals } = buildWeek(data, TODAY, WEEK, money);

	it("sums a past day into one line per app", () => {
		const monday = days[0];
		expect(monday.past).toBe(true);
		expect(monday.plan).toEqual([]);
		expect(monday.done.map((e) => e.title)).toEqual(["💪 Gym, 📚 Reading", "45 PLN spent", "Acme"]);
	});

	it("lists what happened, then what's ahead", () => {
		expect(days[1].done.map((e) => e.title)).toEqual(["Merge PRs", "20 pages read", "Hat"]);
		const thursday = days[3];
		expect(thursday.done).toEqual([]);
		expect(thursday.plan.map((e) => e.title)).toEqual(["Call the garage"]);
		expect(thursday.plan[0].card).toEqual({ id: "c2", title: "Call the garage" });
		expect(days[4].plan.map((e) => e.note)).toEqual(["done cooling: decide"]);
		expect(days[5].plan[0].note).toBe("2400 PLN · recurring");
	});

	it("folds a day of many alike events into one line", () => {
		const { days: busy } = buildWeek(
			{
				...empty,
				jobs: [
					...["A", "B", "C", "D", "E"].map((company) => ({
						date: "2026-11-02",
						company,
						what: "ghosted" as const,
					})),
					{ date: "2026-11-02", company: "Solo", what: "interview" },
				],
			},
			TODAY,
			WEEK,
			money,
		);
		expect(busy[0].done.map((e) => [e.title, e.note])).toEqual([
			["5 closed as ghosted", "A, B, C and 2 more"],
			["Solo", "interview"],
		]);
	});

	it("marks today, which carries both", () => {
		expect(days.filter((d) => d.isToday).map((d) => d.date)).toEqual([TODAY]);
		expect(days[2].past).toBe(false);
	});

	it("totals only the days so far", () => {
		expect(totals).toEqual({
			spent: 45,
			ticks: 2,
			expected: 3,
			pages: 20,
			cardsDone: 1,
			km: 0,
			applied: 1,
		});
	});
});
