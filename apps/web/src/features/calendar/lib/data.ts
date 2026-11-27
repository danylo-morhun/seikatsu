// Server-only reads: the user's own events that touch a run of days. Takes a workspace id, so
// a push or a tool can read them without a session.

import {
	and,
	asc,
	type CalendarEvent,
	calendarEvents,
	db,
	eq,
	gte,
	isNotNull,
	lte,
	or,
} from "@seikatsu/db";
import type { EventFields } from "@/features/calendar/lib/events";

const hhmm = (t: string | null) => t?.slice(0, 5) ?? null;

/** A stored event as the calendar knows it. */
export const toFields = (r: CalendarEvent): EventFields => ({
	id: r.id,
	title: r.title,
	date: r.date,
	endDate: r.endDate,
	startTime: hhmm(r.startTime),
	endTime: hhmm(r.endTime),
	repeat: r.repeat,
	repeatEvery: r.repeatEvery,
	repeatUntil: r.repeatUntil,
	repeatCount: r.repeatCount,
	repeatDays: r.repeatDays,
	repeatByWeekday: r.repeatByWeekday,
	skip: r.skip,
	location: r.location,
	note: r.note,
});

export async function readEvents(
	workspaceId: string,
	from: string,
	to: string,
): Promise<EventFields[]> {
	const rows = await db
		.select()
		.from(calendarEvents)
		.where(
			and(
				eq(calendarEvents.workspaceId, workspaceId),
				lte(calendarEvents.date, to),
				// Repeating ones are worked out in code; the rest must still run on `from`.
				or(
					isNotNull(calendarEvents.repeat),
					gte(calendarEvents.date, from),
					gte(calendarEvents.endDate, from),
				),
			),
		)
		.orderBy(asc(calendarEvents.date), asc(calendarEvents.startTime));
	return rows.map(toFields);
}

export async function readEvent(workspaceId: string, id: string): Promise<EventFields | null> {
	const [r] = await db
		.select()
		.from(calendarEvents)
		.where(and(eq(calendarEvents.workspaceId, workspaceId), eq(calendarEvents.id, id)));
	return r ? toFields(r) : null;
}
