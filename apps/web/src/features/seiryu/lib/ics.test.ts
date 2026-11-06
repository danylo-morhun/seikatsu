import { describe, expect, it } from "vitest";
import { buildCalendar } from "./ics";

const opts = {
	timeZone: "Europe/Warsaw",
	origin: "https://seikatsu.example",
	now: new Date("2026-11-06T22:00:00Z"),
};
const card = {
	id: "c1",
	title: "Call the garage",
	projectId: "p1",
	projectName: "Home",
	dueDate: "2026-11-10",
	dueTime: null,
};

describe("buildCalendar", () => {
	it("makes a day without a time an all-day event", () => {
		const ics = buildCalendar([card], opts);
		expect(ics).toContain("DTSTART;VALUE=DATE:20261110\r\nDTEND;VALUE=DATE:20261111");
		expect(ics).toContain("UID:c1@seikatsu");
		expect(ics).toContain("URL:https://seikatsu.example/seiryu/p1/c1");
		expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
		expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
	});

	it("places a timed card at its instant, half an hour long", () => {
		const ics = buildCalendar([{ ...card, dueTime: "15:00" }], opts);
		expect(ics).toContain("DTSTART:20261110T140000Z\r\nDTEND:20261110T143000Z");
	});

	it("escapes text and folds long lines", () => {
		const ics = buildCalendar(
			[{ ...card, title: `Buy milk, eggs; bread\\ and ${"x".repeat(80)}` }],
			opts,
		);
		expect(ics).toContain("SUMMARY:Buy milk\\, eggs; bread\\\\ and ");
		for (const line of ics.split("\r\n")) expect(line.length).toBeLessThanOrEqual(75);
	});
});
