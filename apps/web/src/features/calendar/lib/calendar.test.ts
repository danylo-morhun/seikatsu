import { describe, expect, it } from "vitest";
import type { WeekData } from "@/features/week/lib/week";
import {
	anchorOf,
	daysOf,
	figuresOf,
	homeViewOf,
	hoursOf,
	hrefOf,
	placeTimed,
	showsToday,
	stepOf,
	titleOf,
} from "./calendar";

describe("homeViewOf", () => {
	it("takes the URL, then the cookie, then the week", () => {
		expect(homeViewOf("month", "day")).toBe("month");
		expect(homeViewOf(undefined, "widgets")).toBe("widgets");
		expect(homeViewOf("nope", "nope")).toBe("week");
	});
});

describe("anchorOf", () => {
	it("keeps a real day and drops the rest", () => {
		expect(anchorOf("2026-11-03", "2026-11-25")).toBe("2026-11-03");
		expect(anchorOf("2026-13-40", "2026-11-25")).toBe("2026-11-25");
		expect(anchorOf(undefined, "2026-11-25")).toBe("2026-11-25");
	});
});

describe("daysOf", () => {
	it("runs a month in whole weeks from Monday", () => {
		const days = daysOf("month", "2026-11-25");
		expect(days[0]).toBe("2026-10-26");
		expect(days.at(-1)).toBe("2026-12-06");
		expect(days.length % 7).toBe(0);
	});
	it("gives the week from Monday, the day alone, and the list two weeks on", () => {
		expect(daysOf("week", "2026-11-25")).toHaveLength(7);
		expect(daysOf("week", "2026-11-25")[0]).toBe("2026-11-23");
		expect(daysOf("day", "2026-11-25")).toEqual(["2026-11-25"]);
		expect(daysOf("list", "2026-11-25")).toHaveLength(14);
	});
});

describe("stepOf", () => {
	it("steps each view by its own length", () => {
		expect(stepOf("month", "2026-01-31", -1)).toBe("2025-12-01");
		expect(stepOf("month", "2026-12-15", 1)).toBe("2027-01-01");
		expect(stepOf("week", "2026-11-25", 1)).toBe("2026-11-30");
		expect(stepOf("day", "2026-11-25", -1)).toBe("2026-11-24");
		expect(stepOf("list", "2026-11-25", 1)).toBe("2026-12-09");
	});
});

describe("showsToday", () => {
	it("counts a month's spill-over days as another month", () => {
		expect(showsToday("month", "2026-12-01", "2026-11-30")).toBe(false);
		expect(showsToday("week", "2026-11-23", "2026-11-25")).toBe(true);
	});
});

describe("titleOf and hrefOf", () => {
	it("names each view", () => {
		expect(titleOf("month", "2026-11-25")).toBe("November 2026");
		expect(titleOf("week", "2026-11-25")).toBe("23 – 29 November");
		expect(titleOf("week", "2026-12-01")).toBe("30 November – 6 December");
		expect(titleOf("day", "2026-11-25")).toBe("Wednesday 25 November");
	});
	it("leaves today out of the link", () => {
		expect(hrefOf("week", "2026-11-25", "2026-11-25")).toBe("/?v=week");
		expect(hrefOf("day", "2026-11-26", "2026-11-25")).toBe("/?v=day&d=2026-11-26");
		expect(hrefOf("widgets", "2026-11-26")).toBe("/?v=widgets");
	});
});

describe("hoursOf", () => {
	it("stretches the working day to hold every timed row", () => {
		expect(hoursOf([])).toEqual({ from: 8, to: 20 });
		expect(hoursOf(["06:30", "22:15"])).toEqual({ from: 6, to: 24 });
	});
});

describe("placeTimed", () => {
	it("puts overlapping rows side by side and lone ones full width", () => {
		const placed = placeTimed([
			{ id: "a", time: "09:00" },
			{ id: "b", time: "09:30" },
			{ id: "c", time: "11:00" },
		]);
		const by = Object.fromEntries(placed.map((p) => [p.entry.id, p]));
		expect([by.a.col, by.a.cols]).toEqual([0, 2]);
		expect([by.b.col, by.b.cols]).toEqual([1, 2]);
		expect([by.c.col, by.c.cols]).toEqual([0, 1]);
	});
	it("reuses a column once it's free", () => {
		const placed = placeTimed([
			{ id: "a", time: "09:00" },
			{ id: "b", time: "09:30" },
			{ id: "c", time: "10:00" },
		]);
		const by = Object.fromEntries(placed.map((p) => [p.entry.id, p]));
		expect(by.c.col).toBe(0);
		expect(by.c.cols).toBe(2);
	});
});

describe("figuresOf", () => {
	it("adds up one day", () => {
		const data: WeekData = {
			spent: [
				{ date: "2026-11-25", amount: 40 },
				{ date: "2026-11-24", amount: 9 },
			],
			ticks: [
				{ date: "2026-11-25", name: "Run", emoji: "" },
				{ date: "2026-11-25", name: "Read", emoji: "" },
			],
			expected: [{ date: "2026-11-25", count: 3 }],
			pages: [],
			driven: [{ date: "2026-11-25", km: 12 }],
			cardsDone: [],
			cardsDue: [],
			jobs: [],
			wants: [],
			car: [],
			bills: [],
		};
		expect(figuresOf(data, "2026-11-25")).toEqual({
			spent: 40,
			ticks: 2,
			expected: 3,
			pages: 0,
			km: 12,
			cardsDone: 0,
		});
	});
});
