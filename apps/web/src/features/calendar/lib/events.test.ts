import { describe, expect, it } from "vitest";
import {
	type EventFields,
	eventRows,
	googleRows,
	movedEvent,
	movedGoogle,
	repeatText,
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
