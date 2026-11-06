import { describe, expect, it } from "vitest";
import { addUnits, nextDueDate, repeatLabel } from "./repeat";

describe("addUnits", () => {
	it("steps days, weeks, months and years", () => {
		expect(addUnits("2026-11-06", 1, "day")).toBe("2026-11-07");
		expect(addUnits("2026-12-30", 2, "week")).toBe("2027-01-13");
		expect(addUnits("2026-11-06", 1, "month")).toBe("2026-12-06");
		expect(addUnits("2026-11-06", 3, "month")).toBe("2027-02-06");
		expect(addUnits("2028-02-29", 1, "year")).toBe("2029-02-28");
	});
	it("keeps a month step inside the month", () => {
		expect(addUnits("2026-01-31", 1, "month")).toBe("2026-02-28");
		expect(addUnits("2026-01-31", 2, "month")).toBe("2026-03-31");
	});
});

describe("nextDueDate", () => {
	const monthly = { every: 1, unit: "month", fromDone: false } as const;
	it("keeps the calendar from the due date", () => {
		expect(nextDueDate(monthly, "2026-11-06", "2026-11-06")).toBe("2026-12-06");
		expect(nextDueDate(monthly, "2026-11-06", "2026-11-09")).toBe("2026-12-06");
		// Done early: still the next month, not the same one.
		expect(nextDueDate(monthly, "2026-11-06", "2026-11-01")).toBe("2026-12-06");
	});
	it("skips steps already behind when done very late", () => {
		expect(nextDueDate(monthly, "2026-09-06", "2026-11-10")).toBe("2026-12-06");
		expect(
			nextDueDate({ every: 1, unit: "day", fromDone: false }, "2026-11-01", "2026-11-06"),
		).toBe("2026-11-07");
	});
	it("counts from done when asked, or with no date", () => {
		expect(
			nextDueDate({ every: 2, unit: "week", fromDone: true }, "2026-11-01", "2026-11-06"),
		).toBe("2026-11-20");
		expect(nextDueDate(monthly, null, "2026-11-06")).toBe("2026-12-06");
	});
});

it("names the rule", () => {
	expect(repeatLabel(1, "week")).toBe("Every week");
	expect(repeatLabel(3, "month")).toBe("Every 3 months");
});
