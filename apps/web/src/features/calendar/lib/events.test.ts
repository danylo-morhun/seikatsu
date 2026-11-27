import { describe, expect, it } from "vitest";
import {
	type EventFields,
	eventRows,
	googleRows,
	movedEvent,
	movedGoogle,
	repeatText,
	splitSeries,
	startsIn,
	whenOf,
} from "./events";

const ev = (over: Partial<EventFields>): EventFields => ({
	id: "e1",
	title: "Dentist",
	date: "2026-11-25",
	endDate: null,
	startTime: null,
	endTime: null,
	repeat: null,
	repeatEvery: 1,
	repeatUntil: null,
	repeatCount: null,
	repeatDays: null,
	repeatByWeekday: false,
	skip: [],
	location: null,
	note: null,
	...over,
});

describe("startsIn", () => {
	it("finds a one-off event only in its range", () => {
		expect(startsIn(ev({}), "2026-11-23", "2026-11-29")).toEqual(["2026-11-25"]);
		expect(startsIn(ev({}), "2026-11-30", "2026-12-06")).toEqual([]);
	});
	it("keeps a several-day event that began before the range", () => {
		const trip = ev({ date: "2026-11-21", endDate: "2026-11-24" });
		expect(startsIn(trip, "2026-11-23", "2026-11-29")).toEqual(["2026-11-21"]);
	});
	it("repeats weekly from far back without walking every week", () => {
		const gym = ev({ date: "2020-01-06", repeat: "week" });
		expect(startsIn(gym, "2026-11-23", "2026-11-29")).toEqual(["2026-11-23"]);
	});
	it("skips months without the day, and stops at its last day", () => {
		const rent = ev({ date: "2026-01-31", repeat: "month" });
		expect(startsIn(rent, "2026-02-01", "2026-04-30")).toEqual(["2026-03-31"]);
		const course = ev({
			date: "2026-11-02",
			repeat: "day",
			repeatEvery: 2,
			repeatUntil: "2026-11-08",
		});
		expect(startsIn(course, "2026-11-01", "2026-11-30")).toEqual([
			"2026-11-02",
			"2026-11-04",
			"2026-11-06",
			"2026-11-08",
		]);
	});
	it("brings a birthday back each year", () => {
		const bday = ev({ date: "1990-03-14", repeat: "year" });
		expect(startsIn(bday, "2027-03-01", "2027-03-31")).toEqual(["2027-03-14"]);
	});
});

describe("eventRows", () => {
	it("puts a timed event at its time and a trip on each of its days", () => {
		const rows = eventRows(
			[
				ev({ startTime: "15:00:00", endTime: "16:30:00" }),
				ev({ id: "trip", title: "Tatry", date: "2026-11-26", endDate: "2026-11-27" }),
			],
			["2026-11-25", "2026-11-26", "2026-11-27"],
		);
		expect(rows.get("2026-11-25")?.[0]).toMatchObject({
			time: "15:00",
			end: "16:30",
			app: "/calendar",
		});
		expect(rows.get("2026-11-26")?.[0]).toMatchObject({ title: "Tatry", note: "day 1 of 2" });
		expect(rows.get("2026-11-27")?.[0]?.time).toBeUndefined();
	});
});

describe("whenOf and repeatText", () => {
	it("says when and how often", () => {
		expect(whenOf(ev({ startTime: "15:00:00", endTime: "16:30:00" }))).toBe("15:00–16:30");
		expect(whenOf(ev({}))).toBe("all day");
		expect(whenOf(ev({ endDate: "2026-11-27" }))).toBe("3 days");
		expect(repeatText(ev({ repeat: "month", repeatEvery: 2 }))).toBe("every 2 months");
		expect(repeatText(ev({ repeat: "week" }))).toBe("every week");
	});
});

describe("movedEvent", () => {
	it("shifts a trip by days and keeps its length", () => {
		const trip = ev({ date: "2026-11-26", endDate: "2026-11-27" });
		expect(movedEvent(trip, "2026-11-27", { date: "2026-11-29" })).toMatchObject({
			date: "2026-11-28",
			endDate: "2026-11-29",
		});
	});
	it("lands at the hour it's dropped on, keeping its duration", () => {
		const call = ev({ startTime: "15:00", endTime: "16:30" });
		expect(movedEvent(call, "2026-11-25", { date: "2026-11-26", time: "09:00" })).toMatchObject({
			date: "2026-11-26",
			startTime: "09:00",
			endTime: "10:30",
		});
		expect(movedEvent(ev({}), "2026-11-25", { date: "2026-11-25", time: "23:30" }).endTime).toBe(
			"23:59",
		);
	});
});

describe("googleRows and movedGoogle", () => {
	const g = {
		calendarId: "c1",
		calendarName: "Work",
		googleId: "w1",
		writable: true,
		recurring: false,
		title: "Standup",
		date: "2026-11-26",
		endDate: null,
		startTime: "09:30",
		endTime: "09:45",
		note: null,
		color: "#4285f4",
		location: "Room 2",
		link: "https://calendar.google.com/x",
	};
	it("shows a Google event in its calendar's colour, opening in Google", () => {
		const [row] = googleRows([g], ["2026-11-26"]).get("2026-11-26") ?? [];
		expect(row).toMatchObject({
			app: "/google",
			time: "09:30",
			end: "09:45",
			color: "#4285f4",
			note: "Room 2 · Work",
			href: "https://calendar.google.com/x",
		});
		expect(row?.google).toMatchObject({ calendarId: "c1", googleId: "w1" });
	});
	it("moves it keeping its quarter hour", () => {
		expect(movedGoogle(g, "2026-11-26", { date: "2026-11-27", time: "11:00" })).toMatchObject({
			date: "2026-11-27",
			startTime: "11:00",
			endTime: "11:15",
		});
	});
});

describe("repeat rules", () => {
	it("repeats weekly on chosen weekdays, every n weeks", () => {
		// 2026-11-25 is a Wednesday.
		const e = ev({ repeat: "week", repeatDays: [1, 3, 5] });
		expect(startsIn(e, "2026-11-23", "2026-12-06")).toEqual([
			"2026-11-25",
			"2026-11-27",
			"2026-11-30",
			"2026-12-02",
			"2026-12-04",
		]);
		const fortnight = ev({ repeat: "week", repeatEvery: 2, repeatDays: [2, 3] });
		expect(startsIn(fortnight, "2026-11-23", "2026-12-13")).toEqual([
			"2026-11-25",
			"2026-12-08",
			"2026-12-09",
		]);
	});

	it("repeats monthly on the nth weekday, or the last", () => {
		// The 4th Wednesday of November 2026.
		const e = ev({ repeat: "month", repeatByWeekday: true });
		expect(startsIn(e, "2026-12-01", "2027-01-31")).toEqual(["2026-12-23", "2027-01-27"]);
		// 2026-11-30 is the last Monday (5th week): the last Monday each month.
		const last = ev({ date: "2026-11-30", repeat: "month", repeatByWeekday: true });
		expect(startsIn(last, "2026-12-01", "2027-02-28")).toEqual([
			"2026-12-28",
			"2027-01-25",
			"2027-02-22",
		]);
	});

	it("stops after a count, skipped days included, and leaves skipped days out", () => {
		const e = ev({ repeat: "day", repeatCount: 3, skip: ["2026-11-26"] });
		expect(startsIn(e, "2026-11-01", "2026-12-31")).toEqual(["2026-11-25", "2026-11-27"]);
	});

	it("says the rule in words", () => {
		expect(repeatText(ev({ repeat: "week", repeatDays: [1, 2, 3, 4, 5] }))).toBe("every weekday");
		expect(repeatText(ev({ repeat: "week", repeatDays: [3, 1] }))).toBe("every week on Mon, Wed");
		expect(repeatText(ev({ repeat: "month", repeatByWeekday: true }))).toBe(
			"every month on the 4th Wed",
		);
		expect(repeatText(ev({ repeat: "day", repeatCount: 5 }))).toBe("every day, 5 times");
	});
});

describe("splitSeries", () => {
	const series = ev({ repeat: "week", skip: ["2026-12-09"] });
	const day = "2026-12-02";

	it("takes one day out, and keeps its change apart", () => {
		const moved = { ...series, date: "2026-12-03", startTime: "10:00" };
		const { save, remove } = splitSeries(series, day, "one", moved, "e2");
		expect(remove).toEqual([]);
		expect(save[0]).toMatchObject({ id: "e1", skip: ["2026-12-02", "2026-12-09"] });
		expect(save[1]).toMatchObject({ id: "e2", date: "2026-12-03", repeat: null, skip: [] });
		expect(splitSeries(series, day, "one", null, "e2").save).toHaveLength(1);
	});

	it("ends the series the day before and carries the rest on", () => {
		const counted = { ...series, repeatCount: 5 };
		const { save } = splitSeries(
			counted,
			day,
			"following",
			{ ...counted, date: day, title: "New" },
			"e2",
		);
		expect(save[0]).toMatchObject({
			id: "e1",
			repeatUntil: "2026-12-01",
			repeatCount: null,
			skip: [],
		});
		// One ran before (25 Nov): four are left.
		expect(save[1]).toMatchObject({
			id: "e2",
			date: day,
			title: "New",
			repeatCount: 4,
			skip: ["2026-12-09"],
		});
	});

	it("from the first day, the following are all of it", () => {
		const { save, remove } = splitSeries(series, series.date, "following", null, "e2");
		expect(save).toEqual([]);
		expect(remove).toEqual(["e1"]);
		expect(
			splitSeries(series, series.date, "following", { ...series, title: "X" }, "e2").save[0],
		).toMatchObject({ id: "e1", title: "X" });
	});

	it("changes or deletes all of it", () => {
		expect(splitSeries(series, day, "all", { ...series, title: "X" }, "e2")).toEqual({
			save: [{ ...series, title: "X" }],
			remove: [],
		});
		expect(splitSeries(series, day, "all", null, "e2")).toEqual({ save: [], remove: ["e1"] });
	});
});
