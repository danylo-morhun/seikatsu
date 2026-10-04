import { describe, expect, it } from "vitest";
import { currentKm, readingConflict } from "./odometer";

const readings = [
	{ date: "2026-01-01", km: 160_000 },
	{ date: "2026-03-01", km: 163_000 },
];

describe("readingConflict", () => {
	it("accepts a newer, higher reading", () => {
		expect(readingConflict(readings, { date: "2026-04-01", km: 164_000 })).toBeNull();
	});

	it("accepts a backfilled reading that fits between", () => {
		expect(readingConflict(readings, { date: "2026-02-01", km: 161_500 })).toBeNull();
	});

	it("rejects a reading lower than an earlier one", () => {
		expect(readingConflict(readings, { date: "2026-04-01", km: 162_000 })).toMatch(/can't go down/);
	});

	it("rejects a backfilled reading higher than a later one", () => {
		expect(readingConflict(readings, { date: "2026-02-01", km: 165_000 })).toMatch(/later reading/);
	});

	it("allows the first reading", () => {
		expect(readingConflict([], { date: "2026-01-01", km: 0 })).toBeNull();
	});
});

describe("currentKm", () => {
	it("is the highest reading", () => {
		expect(currentKm(readings)).toBe(163_000);
		expect(currentKm([])).toBe(0);
	});
});
