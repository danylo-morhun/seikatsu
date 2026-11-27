import { z } from "zod";
import { saveEvent } from "@/features/calendar/actions/events";
import { readGoogleEvents } from "@/features/calendar/google/sync";
import { readEvent, readEvents } from "@/features/calendar/lib/data";
import {
	daysBetween,
	eventRows,
	googleRows,
	REPEATS,
	repeatText,
	whenOf,
} from "@/features/calendar/lib/events";
import { money } from "@/features/home/lib/format";
import { addDays } from "@/features/keizoku/lib/streak";
import { getWeekData } from "@/features/week/lib/data";
import { buildWeek } from "@/features/week/lib/week";
import { modulesOn } from "@/lib/modules";
import { tool } from "./types";

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD");
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "HH:MM, 24h");

/** At most this many days in one read. */
const MAX_DAYS = 62;

const eventFields = {
	title: z.string().min(1).max(200),
	date: day.describe("The (first) day"),
	endDate: day.optional().describe("Last day of an event over several days"),
	startTime: time.optional().describe("Omit for an all-day event"),
	endTime: time.optional().describe("Omit: an hour after the start"),
	repeat: z.enum(REPEATS).optional().describe("Repeats every day/week/month/year from `date`"),
	repeatEvery: z.number().int().min(1).max(99).optional().describe("Every 2 weeks = 2"),
	repeatUntil: day.optional().describe("Last day it repeats on"),
	repeatCount: z
		.number()
		.int()
		.min(1)
		.max(999)
		.optional()
		.describe("Stops after this many times (not with repeatUntil)"),
	repeatDays: z
		.array(z.number().int().min(1).max(7))
		.max(7)
		.optional()
		.describe("Weekly: its weekdays, 1 = Monday … 7 = Sunday"),
	repeatByWeekday: z
		.boolean()
		.optional()
		.describe(
			"Monthly: on `date`'s weekday of that week (the 2nd Tuesday) instead of its day number",
		),
	note: z.string().max(2000).optional(),
};

/** An hour after "HH:MM", within the day. */
function hourAfter(t: string): string {
	const [h, m] = t.split(":").map(Number);
	const end = Math.min(23 * 60 + 59, h * 60 + m + 60);
	return `${String(Math.floor(end / 60)).padStart(2, "0")}:${String(end % 60).padStart(2, "0")}`;
}

export const calendarTools = [
	tool({
		name: "calendar",
		title: "Calendar",
		description:
			"The calendar over any run of days (up to 62): each day's own events (with ids), the connected Google calendars' events, and every app's dated rows — cards due (with times), booked calls, car due, recurring payments, wants done cooling; for days behind, what got done. Use for 'what's on next week', 'am I free on Friday at 3'.",
		input: {
			from: day.optional().describe("First day; default today"),
			to: day.optional().describe("Last day; default `from` + 6"),
		},
		run: async ({ from, to }, { ws, today }) => {
			const start = from ?? today;
			const end = to ?? addDays(start, 6);
			if (end < start) return { error: "`to` is before `from`" };
			if (daysBetween(start, end) >= MAX_DAYS) return { error: `At most ${MAX_DAYS} days at once` };
			const dates: string[] = [];
			for (let d = start; d <= end; d = addDays(d, 1)) dates.push(d);
			const fmt = (n: number, c = ws.baseCurrency) => money(n, c);
			const [data, events, google] = await Promise.all([
				getWeekData(ws, today, dates, modulesOn(ws.modulesOff)),
				readEvents(ws.id, start, end),
				readGoogleEvents(ws.id, start, end),
			]);
			const { days } = buildWeek(data, today, dates, fmt);
			const own = eventRows(events, dates);
			const theirs = googleRows(google, dates);
			return {
				days: days.map((d) => ({
					date: d.date,
					today: d.isToday || undefined,
					events: (own.get(d.date) ?? []).map((e) => ({
						id: e.event?.id,
						title: e.title,
						start: e.time,
						end: e.end,
						note: e.note || undefined,
					})),
					google: (theirs.get(d.date) ?? []).map((e) => ({
						calendar: e.google?.calendarName,
						title: e.title,
						start: e.time,
						end: e.end,
						note: e.note || undefined,
					})),
					plan: d.plan.map(({ app, title, note, time, card }) => ({
						app: app.slice(1),
						title,
						note,
						time,
						cardId: card?.id,
					})),
					done: d.done.map(({ app, title, note }) => ({ app: app.slice(1), title, note })),
				})),
			};
		},
	}),
	tool({
		name: "calendar_add_event",
		title: "Add an event",
		description:
			"Adds an event of the user's own to the calendar: a dentist at 15:00, a trip over several days, a birthday every year. For a task to do, make a Seiryu card instead.",
		input: eventFields,
		write: true,
		run: async (args) => {
			const id = crypto.randomUUID();
			const result = await saveEvent({
				id,
				title: args.title,
				date: args.date,
				endDate: args.endDate ?? null,
				startTime: args.startTime ?? null,
				endTime: args.startTime ? (args.endTime ?? hourAfter(args.startTime)) : null,
				repeat: args.repeat ?? null,
				repeatEvery: args.repeatEvery ?? 1,
				repeatUntil: args.repeatUntil ?? null,
				repeatCount: args.repeatCount ?? null,
				repeatDays: args.repeatDays ?? null,
				repeatByWeekday: args.repeatByWeekday ?? false,
				note: args.note ?? null,
			});
			return "error" in result ? result : { id };
		},
	}),
	tool({
		name: "calendar_update_event",
		title: "Change an event",
		description:
			"Changes an event by id (from `calendar`). Only the fields given change; pass null to clear endDate, startTime (all day), repeat or note. A repeating event changes as a whole.",
		input: {
			id: z.uuid(),
			title: eventFields.title.optional(),
			date: day.optional(),
			endDate: day.nullable().optional(),
			startTime: time.nullable().optional(),
			endTime: time.nullable().optional(),
			repeat: z.enum(REPEATS).nullable().optional(),
			repeatEvery: z.number().int().min(1).max(99).optional(),
			repeatUntil: day.nullable().optional(),
			repeatCount: z.number().int().min(1).max(999).nullable().optional(),
			repeatDays: z.array(z.number().int().min(1).max(7)).max(7).nullable().optional(),
			repeatByWeekday: z.boolean().optional(),
			note: z.string().max(2000).nullable().optional(),
		},
		write: true,
		idempotent: true,
		run: async ({ id, ...patch }, { ws }) => {
			const event = await readEvent(ws.id, id);
			if (!event) return { error: "Event not found" };
			const next = { ...event };
			for (const [k, v] of Object.entries(patch))
				if (v !== undefined) Object.assign(next, { [k]: v });
			if (!next.startTime) next.endTime = null;
			else if (!next.endTime || next.endTime <= next.startTime)
				next.endTime = hourAfter(next.startTime);
			const result = await saveEvent(next);
			return "error" in result
				? result
				: { id, when: whenOf(next), repeats: repeatText(next) ?? undefined };
		},
	}),
];
