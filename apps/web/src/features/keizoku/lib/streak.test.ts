import { describe, expect, it } from "vitest";
import {
	type HabitSchedule,
	addDays,
	computeStreak,
	firstDay,
	isDue,
	lastDays,
	mondayOf,
	rate,
	tally,
	thisWeek,
} from "./streak";

const daily: HabitSchedule = { frequencyType: "daily", frequencyDays: null, frequencyTarget: null };
// Mon, Wed, Fri
const mwf: HabitSchedule = {
	frequencyType: "weekdays",
	frequencyDays: [1, 3, 5],
	frequencyTarget: null,
};
const thrice: HabitSchedule = {
	frequencyType: "times_per_week",
	frequencyDays: null,
	frequencyTarget: 3,
};

// 2026-10-14 is a Wednesday.
const TODAY = "2026-10-14";

describe("calendar days", () => {
	it("moves across months and DST changes without drifting", () => {
		expect(addDays("2026-10-24", 2)).toBe("2026-10-26");
		expect(addDays("2026-03-28", 2)).toBe("2026-03-30");
		expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
	});

	it("finds the Monday of a week, Sunday included", () => {
		expect(mondayOf(TODAY)).toBe("2026-10-12");
		expect(mondayOf("2026-10-18")).toBe("2026-10-12");
		expect(mondayOf("2026-10-12")).toBe("2026-10-12");
	});

	it("lists the last days oldest first", () => {
		expect(lastDays(TODAY, 3)).toEqual(["2026-10-12", "2026-10-13", TODAY]);
	});
});

describe("isDue", () => {
	it("puts weekday habits on their days only, weekly targets on every day", () => {
		expect(isDue(mwf, TODAY)).toBe(true);
		expect(isDue(mwf, "2026-10-13")).toBe(false);
		expect(isDue(thrice, "2026-10-13")).toBe(true);
	});
});

describe("computeStreak", () => {
	it("counts back from today and keeps the run while today is open", () => {
		expect(computeStreak(daily, ["2026-10-12", "2026-10-13"], TODAY)).toEqual({
			current: 2,
			best: 2,
		});
		expect(computeStreak(daily, ["2026-10-12", "2026-10-13", TODAY], TODAY).current).toBe(3);
	});

	it("breaks on a missed past day and remembers the best run", () => {
		const logs = ["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-13"];
		expect(computeStreak(daily, logs, TODAY)).toEqual({ current: 1, best: 3 });
	});

	it("skips days a weekday habit isn't due", () => {
		// Fri 9, Mon 12 — Sat/Sun are not due.
		expect(computeStreak(mwf, ["2026-10-09", "2026-10-12"], TODAY).current).toBe(2);
	});

	it("counts weeks that met a weekly target, the week in progress included when met", () => {
		const logs = [
			"2026-09-29",
			"2026-09-30",
			"2026-10-01",
			"2026-10-06",
			"2026-10-07",
			"2026-10-08",
		];
		expect(computeStreak(thrice, logs, TODAY)).toEqual({ current: 2, best: 2 });
	});

	it("ignores check-ins after today", () => {
		expect(computeStreak(daily, ["2026-10-15"], TODAY)).toEqual({ current: 0, best: 0 });
	});
});

describe("tally", () => {
	it("starts at the habit's first day, not the start of the range", () => {
		const logs = ["2026-10-12", "2026-10-13", TODAY];
		const t = tally(daily, logs, addDays(TODAY, -29), TODAY, "2026-10-12");
		expect(t).toEqual({ done: 3, expected: 3 });
		expect(rate(t)).toBe(100);
	});

	it("stops at the day a habit was archived", () => {
		expect(tally(daily, ["2026-10-01"], "2026-10-01", TODAY, "2026-10-01", "2026-10-02")).toEqual({
			done: 1,
			expected: 2,
		});
	});

	it("never counts an off-schedule extra past what was due", () => {
		// Tue 13 is not due for MWF.
		expect(tally(mwf, ["2026-10-12", "2026-10-13"], "2026-10-12", TODAY, "2026-10-01")).toEqual({
			done: 1,
			expected: 2,
		});
	});

	it("expects a weekly target per week, capped by the days left in a partial week", () => {
		// Mon 12 – Wed 14: three days of the week, target 3.
		expect(tally(thrice, ["2026-10-12", "2026-10-13"], "2026-10-12", TODAY, "2026-10-01")).toEqual({
			done: 2,
			expected: 3,
		});
		// Only Wed 14 in range: one day, so at most one check-in is due.
		expect(tally(thrice, [TODAY], TODAY, TODAY, "2026-10-01")).toEqual({ done: 1, expected: 1 });
	});

	it("says nothing was due rather than 0%", () => {
		expect(rate(tally(daily, [], TODAY, TODAY, "2026-10-20"))).toBeNull();
	});
});

describe("firstDay and thisWeek", () => {
	it("takes a back-filled check-in before creation as the first day", () => {
		expect(firstDay("2026-10-10", ["2026-10-08", "2026-10-12"])).toBe("2026-10-08");
		expect(firstDay("2026-10-10", [])).toBe("2026-10-10");
	});

	it("counts check-ins since Monday", () => {
		expect(thisWeek(["2026-10-11", "2026-10-12", TODAY], TODAY)).toBe(2);
	});
});
