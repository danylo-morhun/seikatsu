import { describe, expect, it } from "vitest";
import { carYear, carYears, kmAt } from "./year";

const readings = [
	{ date: "2026-10-04", km: 167_000 },
	{ date: "2026-10-14", km: 168_000 },
];

describe("kmAt", () => {
	it("draws a line between readings", () => {
		expect(kmAt(readings, "2026-10-09")).toBe(167_500);
	});

	it("doesn't guess before the first or after the last", () => {
		expect(kmAt(readings, "2026-01-01")).toBe(167_000);
		expect(kmAt(readings, "2027-01-01")).toBe(168_000);
	});

	it("is null with no readings", () => {
		expect(kmAt([], "2026-01-01")).toBeNull();
	});
});

describe("carYear", () => {
	it("splits km and spend by month", () => {
		const year = carYear(
			readings,
			[
				{ date: "2026-10-10", cost: "450.00" },
				{ date: "2026-10-20", cost: null },
				{ date: "2025-12-01", cost: "99.00" },
			],
			2026,
		);
		expect(year.driven).toBe(1_000);
		expect(year.months[9]).toEqual({ km: 1_000, spent: 450, services: 2 });
		expect(year.months[8].km).toBe(0);
		expect(year.spent).toBe(450);
		expect(year.services).toBe(2);
	});
});

describe("carYears", () => {
	it("lists years with data, newest first, with this year", () => {
		expect(carYears(["2025-03-01", "2024-01-01", "2025-05-05"], 2026)).toEqual([2026, 2025, 2024]);
	});
});
