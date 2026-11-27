import { describe, expect, it } from "vitest";
import { editOf, fromGoogle, hashOf, localOf, rruleOf, toGoogle } from "./map";

describe("localOf", () => {
	it("reads an instant on the user's clock", () => {
		expect(localOf("2026-11-26T14:00:00Z", "Europe/Warsaw")).toEqual({
			date: "2026-11-26",
			time: "15:00",
		});
		expect(localOf("2026-11-26T23:30:00Z", "Europe/Warsaw")).toEqual({
			date: "2026-11-27",
			time: "00:30",
		});
	});
});

describe("fromGoogle", () => {
	it("keeps all-day days inclusive", () => {
		expect(
			fromGoogle(
				{ id: "a", summary: "Tatry", start: { date: "2026-11-28" }, end: { date: "2026-11-30" } },
				"UTC",
			),
		).toMatchObject({ date: "2026-11-28", endDate: "2026-11-29", startTime: null });
		expect(
			fromGoogle({ id: "b", start: { date: "2026-11-28" }, end: { date: "2026-11-29" } }, "UTC"),
		).toMatchObject({ endDate: null, title: "(No title)" });
	});
	it("puts a timed event on the user's clock and drops cancelled ones", () => {
		expect(
			fromGoogle(
				{
					id: "c",
					summary: "Call",
					start: { dateTime: "2026-11-26T09:00:00-05:00" },
					end: { dateTime: "2026-11-26T10:00:00-05:00" },
					recurringEventId: "r",
				},
				"Europe/Warsaw",
			),
		).toMatchObject({ date: "2026-11-26", startTime: "15:00", endTime: "16:00", recurring: true });
		expect(fromGoogle({ id: "d", status: "cancelled" }, "UTC")).toBeNull();
	});
});

describe("toGoogle", () => {
	it("writes all-day ends exclusive and times in the zone", () => {
		const allDay = toGoogle(
			{ key: "event:1", title: "Tatry", date: "2026-11-28", endDate: "2026-11-29", link: "x" },
			"Europe/Warsaw",
		);
		expect(allDay.start).toEqual({ date: "2026-11-28" });
		expect(allDay.end).toEqual({ date: "2026-11-30" });
		const timed = toGoogle(
			{ key: "seiryu:2", title: "Call", date: "2026-11-26", startTime: "15:00", link: "x" },
			"Europe/Warsaw",
		);
		expect(timed.end).toEqual({ dateTime: "2026-11-26T16:00:00", timeZone: "Europe/Warsaw" });
		expect(timed.extendedProperties.private.seikatsuKey).toBe("seiryu:2");
	});
	it("hashes the same body the same", () => {
		const body = toGoogle({ key: "k", title: "A", date: "2026-11-26", link: "x" }, "UTC");
		expect(hashOf(body)).toBe(hashOf(structuredClone(body)));
		expect(hashOf({ ...body, summary: "B" })).not.toBe(hashOf(body));
	});
});

describe("rruleOf and editOf", () => {
	it("writes repeats as RRULE", () => {
		const base = {
			date: "2026-11-25",
			startTime: null,
			repeatEvery: 1,
			repeatUntil: null,
			repeatCount: null,
			repeatDays: null,
			repeatByWeekday: false,
			skip: [],
		};
		const zone = "Europe/Warsaw";
		expect(
			rruleOf({ ...base, repeat: "week", repeatEvery: 2, repeatUntil: "2027-01-31" }, zone),
		).toEqual(["RRULE:FREQ=WEEKLY;INTERVAL=2;UNTIL=20270131"]);
		expect(rruleOf({ ...base, repeat: null }, zone)).toEqual([]);
		expect(
			rruleOf(
				{ ...base, repeat: "week", repeatDays: [5, 1], repeatCount: 10, skip: ["2026-12-04"] },
				zone,
			),
		).toEqual(["RRULE:FREQ=WEEKLY;BYDAY=MO,FR;COUNT=10", "EXDATE;VALUE=DATE:20261204"]);
		expect(
			rruleOf(
				{
					...base,
					repeat: "month",
					repeatByWeekday: true,
					startTime: "09:30",
					skip: ["2026-12-23"],
				},
				zone,
			),
		).toEqual(["RRULE:FREQ=MONTHLY;BYDAY=4WE", "EXDATE;TZID=Europe/Warsaw:20261223T093000"]);
	});
	it("takes seikatsu's own link off an edited note", () => {
		const edit = editOf(
			{
				id: "e",
				summary: "Dentist",
				description: "Dr Nowak\n\nhttps://seikatsu.example/?v=day&d=2026-11-26",
				start: { date: "2026-11-26" },
				end: { date: "2026-11-27" },
			},
			"UTC",
		);
		expect(edit?.note).toBe("Dr Nowak");
	});
});
