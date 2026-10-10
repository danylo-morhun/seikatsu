import { describe, expect, it } from "vitest";
import { formatDateTime, formatDayDate, formatShortDate, previousRange } from "./dates";

describe("previousRange", () => {
	it("steps back one whole month", () => {
		expect(previousRange("2026-10-01", "2026-10-31")).toEqual({
			from: "2026-09-01",
			to: "2026-09-30",
		});
	});

	it("keeps multi-month ranges month-aligned across years", () => {
		expect(previousRange("2026-01-01", "2026-03-31")).toEqual({
			from: "2025-10-01",
			to: "2025-12-31",
		});
	});

	it("shifts arbitrary ranges by their length in days", () => {
		expect(previousRange("2026-10-05", "2026-10-11")).toEqual({
			from: "2026-09-28",
			to: "2026-10-04",
		});
	});
});

describe("formatShortDate", () => {
	it("drops the year inside today's year", () => {
		expect(formatShortDate("2026-09-11", "2026-10-10")).toBe("Sep 11");
	});

	it("keeps the year outside it", () => {
		expect(formatShortDate("2025-12-30", "2026-01-02")).toBe("Dec 30, 2025");
	});
});

describe("formatDayDate", () => {
	it("leads with the weekday", () => {
		expect(formatDayDate("2026-09-10", "2026-10-10")).toBe("Thu, Sep 10");
		expect(formatDayDate("2025-09-10", "2026-10-10")).toBe("Wed, Sep 10, 2025");
	});
});

describe("formatDateTime", () => {
	it("adds the time and keeps the year rule", () => {
		const now = new Date(2026, 9, 10);
		expect(formatDateTime(new Date(2026, 8, 11, 8, 57), now)).toBe("Sep 11, 08:57");
		expect(formatDateTime(new Date(2025, 8, 11, 8, 57), now)).toBe("Sep 11, 2025, 08:57");
	});
});
