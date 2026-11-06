// The cards with a due date as an iCalendar feed (RFC 5545), for a phone's calendar to
// subscribe to. Pure: the route reads the cards and the zone, this writes the text.

import { zonedInstant } from "@/features/pwa/lib/schedule";
import { addUnits } from "@/features/seiryu/lib/repeat";

export interface FeedCard {
	id: string;
	title: string;
	projectId: string;
	projectName: string;
	dueDate: string;
	/** "HH:MM", or null for an all-day event. */
	dueTime: string | null;
}

/** A timed card takes this long in the calendar. */
const EVENT_MINUTES = 30;

/** Text values escape \ ; , and newlines. */
const text = (value: string) =>
	value.replace(/\\/g, "\\\\").replace(/;/g, ";").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

const utc = (at: Date) =>
	at
		.toISOString()
		.replace(/[-:]/g, "")
		.replace(/\.\d{3}/, "");
const dateOnly = (day: string) => day.replace(/-/g, "");

/** Lines longer than 75 characters fold onto the next, which starts with a space. */
function fold(line: string): string {
	const parts: string[] = [];
	let rest = line;
	while (rest.length > 75) {
		parts.push(rest.slice(0, 75));
		rest = ` ${rest.slice(75)}`;
	}
	parts.push(rest);
	return parts.join("\r\n");
}

export function buildCalendar(
	cards: FeedCard[],
	{ timeZone, origin, now }: { timeZone: string; origin: string; now: Date },
): string {
	const lines = [
		"BEGIN:VCALENDAR",
		"VERSION:2.0",
		"PRODID:-//seikatsu//Seiryu//EN",
		"CALSCALE:GREGORIAN",
		"METHOD:PUBLISH",
		"X-WR-CALNAME:Seiryu",
		// Calendars poll on their own schedule; this asks for hourly.
		"REFRESH-INTERVAL;VALUE=DURATION:PT1H",
		"X-PUBLISHED-TTL:PT1H",
	];
	for (const card of cards) {
		const url = `${origin}/seiryu/${card.projectId}/${card.id}`;
		lines.push("BEGIN:VEVENT", `UID:${card.id}@seikatsu`, `DTSTAMP:${utc(now)}`);
		if (card.dueTime) {
			const start = zonedInstant(card.dueDate, card.dueTime, timeZone);
			const end = new Date(start.getTime() + EVENT_MINUTES * 60_000);
			lines.push(`DTSTART:${utc(start)}`, `DTEND:${utc(end)}`);
		} else {
			lines.push(
				`DTSTART;VALUE=DATE:${dateOnly(card.dueDate)}`,
				`DTEND;VALUE=DATE:${dateOnly(addUnits(card.dueDate, 1, "day"))}`,
			);
		}
		lines.push(
			`SUMMARY:${text(card.title)}`,
			`DESCRIPTION:${text(`${card.projectName}\n${url}`)}`,
			`URL:${url}`,
			"TRANSP:TRANSPARENT",
			"END:VEVENT",
		);
	}
	lines.push("END:VCALENDAR");
	return `${lines.map(fold).join("\r\n")}\r\n`;
}
