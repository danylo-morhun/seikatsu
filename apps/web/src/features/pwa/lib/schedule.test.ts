import { describe, expect, it } from "vitest";
import { isTimeDue, localClock, safeTimeZone, timeToMinutes } from "./schedule";

describe("localClock", () => {
	it("reads the day, time and weekday in the given zone", () => {
		// 2026-10-25 is a Sunday; 20:30 UTC is 21:30 in Warsaw (CET, after the DST switch).
		const at = new Date("2026-10-25T20:30:00Z");
		expect(localClock("Europe/Warsaw", at)).toEqual({
			day: "2026-10-25",
			minutes: 21 * 60 + 30,
			weekday: 7,
		});
		expect(localClock("Asia/Tokyo", at)).toEqual({
			day: "2026-10-26",
			minutes: 5 * 60 + 30,
			weekday: 1,
		});
	});

	it("keeps midnight as 0, not 24", () => {
		expect(localClock("UTC", new Date("2026-10-26T00:05:00Z")).minutes).toBe(5);
	});
});

describe("isTimeDue", () => {
	const at = (minutes: number) => ({ day: "2026-10-25", minutes, weekday: 7 });

	it("is due from the time for an hour", () => {
		expect(isTimeDue("21:00", at(21 * 60 - 1))).toBe(false);
		expect(isTimeDue("21:00", at(21 * 60))).toBe(true);
		expect(isTimeDue("21:00:00", at(21 * 60 + 59))).toBe(true);
		expect(isTimeDue("21:00", at(22 * 60))).toBe(false);
	});

	it("parses Postgres times", () => {
		expect(timeToMinutes("09:15:00")).toBe(555);
	});
});

describe("safeTimeZone", () => {
	it("falls back to UTC for unknown zones", () => {
		expect(safeTimeZone("Europe/Kyiv")).toBe("Europe/Kyiv");
		expect(safeTimeZone("Mars/Olympus")).toBe("UTC");
		expect(safeTimeZone(null)).toBe("UTC");
	});
});
