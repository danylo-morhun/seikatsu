// Google Calendar's events ⇄ seikatsu's, pure. Google keeps instants with offsets and all-day
// ends exclusive; seikatsu keeps the user's wall clock and inclusive last days.

import { addDays, type EventFields } from "@/features/calendar/lib/events";

/** The fields of a Google event this needs (events.list / insert / patch). */
export type GoogleEvent = {
	id: string;
	status?: "confirmed" | "tentative" | "cancelled";
	summary?: string;
	description?: string;
	location?: string;
	htmlLink?: string;
	updated?: string;
	recurringEventId?: string;
	start?: { date?: string; dateTime?: string; timeZone?: string };
	end?: { date?: string; dateTime?: string; timeZone?: string };
	extendedProperties?: { private?: Record<string, string> };
};

/** A Google event as the calendar shows it, on the user's clock. */
export type CachedEvent = {
	googleId: string;
	title: string;
	date: string;
	endDate: string | null;
	startTime: string | null;
	endTime: string | null;
	location: string | null;
	note: string | null;
	link: string | null;
	recurring: boolean;
};

/** An instant's day and "HH:MM" in `timeZone`. */
export function localOf(instant: string, timeZone: string): { date: string; time: string } {
	const parts = new Intl.DateTimeFormat("en-CA", {
		timeZone,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		hourCycle: "h23",
	}).formatToParts(new Date(instant));
	const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
	return {
		date: `${get("year")}-${get("month")}-${get("day")}`,
		time: `${get("hour")}:${get("minute")}`,
	};
}

/** A Google event → a row to keep, or null when it's cancelled or has no start. */
export function fromGoogle(e: GoogleEvent, timeZone: string): CachedEvent | null {
	if (e.status === "cancelled" || !e.start) return null;
	const base = {
		googleId: e.id,
		title: e.summary?.trim() || "(No title)",
		location: e.location ?? null,
		note: e.description ?? null,
		link: e.htmlLink ?? null,
		recurring: Boolean(e.recurringEventId),
	};
	if (e.start.date) {
		// All day: Google's end is the day after the last.
		const last = e.end?.date ? addDays(e.end.date, -1) : e.start.date;
		return {
			...base,
			date: e.start.date,
			endDate: last > e.start.date ? last : null,
			startTime: null,
			endTime: null,
		};
	}
	if (!e.start.dateTime) return null;
	const start = localOf(e.start.dateTime, timeZone);
	const end = e.end?.dateTime ? localOf(e.end.dateTime, timeZone) : null;
	// Past midnight: one row over the days, its times kept for the note.
	const lastDay = end && end.time === "00:00" ? addDays(end.date, -1) : end?.date;
	return {
		...base,
		date: start.date,
		endDate: lastDay && lastDay > start.date ? lastDay : null,
		startTime: start.time,
		endTime: end && end.date === start.date ? end.time : null,
	};
}

const RRULE_FREQ = { day: "DAILY", week: "WEEKLY", month: "MONTHLY", year: "YEARLY" } as const;

/** An event's repeat as Google's RRULE, or none. */
export function rruleOf(e: Pick<EventFields, "repeat" | "repeatEvery" | "repeatUntil">): string[] {
	if (!e.repeat) return [];
	const parts = [`FREQ=${RRULE_FREQ[e.repeat]}`];
	if (e.repeatEvery > 1) parts.push(`INTERVAL=${e.repeatEvery}`);
	if (e.repeatUntil) parts.push(`UNTIL=${e.repeatUntil.replaceAll("-", "")}`);
	return [`RRULE:${parts.join(";")}`];
}

/** One row of seikatsu's to write to its Google calendar. */
export type MirrorItem = {
	/** `event:<id>`, `seiryu:<card id>`, `kyuu:<id>:<date>`, `aisha:<date>:<name>`, `bill:<id>`. */
	key: string;
	title: string;
	date: string;
	endDate?: string | null;
	startTime?: string | null;
	endTime?: string | null;
	note?: string | null;
	recurrence?: string[];
	/** Back to it in seikatsu. */
	link: string;
};

const hourAfter = (t: string) => {
	const [h, m] = t.split(":").map(Number);
	const end = Math.min(23 * 60 + 59, h * 60 + m + 60);
	return `${String(Math.floor(end / 60)).padStart(2, "0")}:${String(end % 60).padStart(2, "0")}`;
};

/** A mirrored row as Google's event body, in the user's zone. */
export function toGoogle(item: MirrorItem, timeZone: string) {
	const last = item.endDate && item.endDate > item.date ? item.endDate : item.date;
	const timed = Boolean(item.startTime);
	return {
		summary: item.title,
		description: [item.note, item.link].filter(Boolean).join("\n\n"),
		start: timed
			? { dateTime: `${item.date}T${item.startTime}:00`, timeZone }
			: { date: item.date },
		end: timed
			? {
					dateTime: `${last}T${item.endTime ?? hourAfter(item.startTime as string)}:00`,
					timeZone,
				}
			: { date: addDays(last, 1) },
		...(item.recurrence?.length ? { recurrence: item.recurrence } : {}),
		extendedProperties: { private: { seikatsuKey: item.key } },
		reminders: { useDefault: false },
		transparency: timed ? "opaque" : "transparent",
	};
}

/** A stable fingerprint of what's sent: unchanged rows aren't written again. */
export function hashOf(body: unknown): string {
	const json = JSON.stringify(body);
	let h = 5381;
	for (let i = 0; i < json.length; i++) h = ((h << 5) + h + json.charCodeAt(i)) | 0;
	return `${(h >>> 0).toString(36)}:${json.length}`;
}

/** What changed in Google, as seikatsu fields: day, times, title, note. */
export function editOf(e: GoogleEvent, timeZone: string) {
	const row = fromGoogle(e, timeZone);
	if (!row) return null;
	// The note seikatsu wrote ends with its own link: take it off again.
	const note = row.note?.replace(/\n*\s*https?:\/\/\S+\s*$/, "").trim() || null;
	return { ...row, note };
}
