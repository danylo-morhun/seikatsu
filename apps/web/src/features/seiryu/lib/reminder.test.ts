import { describe, expect, it } from "vitest";
import { zonedInstant } from "@/features/pwa/lib/schedule";
import { dueLabel, nextDue, reminderAt } from "./reminder";

describe("zonedInstant", () => {
	it("reads a wall clock in the zone", () => {
		expect(zonedInstant("2026-11-06", "15:00", "Europe/Warsaw").toISOString()).toBe(
			"2026-11-06T14:00:00.000Z",
		);
		expect(zonedInstant("2026-07-06", "15:00", "Europe/Warsaw").toISOString()).toBe(
			"2026-07-06T13:00:00.000Z",
		);
		expect(zonedInstant("2026-11-06", "00:30", "UTC").toISOString()).toBe(
			"2026-11-06T00:30:00.000Z",
		);
		expect(zonedInstant("2026-11-06", "09:00", "America/New_York").toISOString()).toBe(
			"2026-11-06T14:00:00.000Z",
		);
	});

	it("survives the clock change days", () => {
		// Warsaw springs forward 2026-03-29 02:00 → 03:00, falls back 2026-10-25 03:00 → 02:00.
		expect(zonedInstant("2026-03-29", "12:00", "Europe/Warsaw").toISOString()).toBe(
			"2026-03-29T10:00:00.000Z",
		);
		expect(zonedInstant("2026-10-25", "12:00", "Europe/Warsaw").toISOString()).toBe(
			"2026-10-25T11:00:00.000Z",
		);
	});
});

describe("reminderAt", () => {
	const tz = "Europe/Warsaw";
	it("is the due moment minus the lead", () => {
		expect(
			reminderAt({ dueDate: "2026-11-10", dueTime: "15:00", remindMinutes: 15 }, tz)?.toISOString(),
		).toBe("2026-11-10T13:45:00.000Z");
	});
	it("starts a day with no time at nine", () => {
		expect(
			reminderAt({ dueDate: "2026-11-10", dueTime: null, remindMinutes: 1440 }, tz)?.toISOString(),
		).toBe("2026-11-09T08:00:00.000Z");
	});
	it("is null without a date or a reminder", () => {
		expect(reminderAt({ dueDate: null, dueTime: "15:00", remindMinutes: 0 }, tz)).toBeNull();
		expect(
			reminderAt({ dueDate: "2026-11-10", dueTime: "15:00", remindMinutes: null }, tz),
		).toBeNull();
	});
});

describe("nextDue", () => {
	const none = { dueDate: null, dueTime: null, remindMinutes: null };
	it("clears time and reminder with the date", () => {
		expect(
			nextDue({ dueDate: "2026-11-10", dueTime: "15:00", remindMinutes: 0 }, { dueDate: null }),
		).toEqual(none);
	});
	it("turns a reminder on with a first time", () => {
		expect(nextDue({ ...none, dueDate: "2026-11-10" }, { dueTime: "15:00" }).remindMinutes).toBe(0);
	});
	it("keeps a reminder chosen with it, or one turned off", () => {
		expect(
			nextDue({ ...none, dueDate: "2026-11-10" }, { dueTime: "15:00", remindMinutes: 60 })
				.remindMinutes,
		).toBe(60);
		expect(
			nextDue(
				{ dueDate: "2026-11-10", dueTime: "15:00", remindMinutes: null },
				{ dueTime: "16:00" },
			).remindMinutes,
		).toBeNull();
	});
});

describe("dueLabel", () => {
	it("names near days in words", () => {
		expect(dueLabel("2026-11-06", "15:00", "2026-11-06", "2026-11-07")).toBe("Today 15:00");
		expect(dueLabel("2026-11-07", null, "2026-11-06", "2026-11-07")).toBe("Tomorrow");
		expect(dueLabel("2026-11-14", "09:30", "2026-11-06", "2026-11-07")).toBe("Sat 14 Nov 09:30");
	});
});
