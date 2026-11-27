// Server-only: the user's events (own and the shown Google calendars') whose name, place or note
// has the words searched for. A repeating event is found on its nearest day.

import {
	and,
	calendarEvents,
	db,
	eq,
	googleCalendars,
	googleEvents,
	ilike,
	or,
} from "@seikatsu/db";
import { toFields } from "@/features/calendar/lib/data";
import { type CalEntry, nearestStart, repeatText, whenOf } from "@/features/calendar/lib/events";

/** A row found, on the day it's on. */
export type Found = CalEntry & { date: string };

/** At most this many of each kind. */
const LIMIT = 40;

export async function searchEvents(
	workspaceId: string,
	q: string,
	today: string,
): Promise<Found[]> {
	const text = q.trim();
	if (text.length < 2) return [];
	// The user's text is a literal: %, _ and \ match themselves.
	const like = `%${text.replace(/[\\%_]/g, "\\$&")}%`;
	const [own, google] = await Promise.all([
		db
			.select()
			.from(calendarEvents)
			.where(
				and(
					eq(calendarEvents.workspaceId, workspaceId),
					or(
						ilike(calendarEvents.title, like),
						ilike(calendarEvents.location, like),
						ilike(calendarEvents.note, like),
					),
				),
			)
			.limit(LIMIT),
		db
			.select({
				event: googleEvents,
				calendarName: googleCalendars.name,
				color: googleCalendars.color,
			})
			.from(googleEvents)
			.innerJoin(googleCalendars, eq(googleCalendars.id, googleEvents.calendarId))
			.where(
				and(
					eq(googleEvents.workspaceId, workspaceId),
					eq(googleCalendars.shown, true),
					or(ilike(googleEvents.title, like), ilike(googleEvents.location, like)),
				),
			)
			.limit(LIMIT),
	]);
	const events = own.map(toFields);
	const found: Found[] = [
		...events.map((e) => {
			const date = nearestStart(e, today);
			return {
				key: `event:${e.id}`,
				app: "/calendar" as const,
				title: e.title,
				date,
				note: [whenOf(e), e.location, repeatText(e)].filter(Boolean).join(" · "),
				href: `/?v=day&d=${date}`,
				event: e,
				occurrence: e.repeat ? date : undefined,
			};
		}),
		...google.map(({ event: g, calendarName, color }) => ({
			key: `google:${g.calendarId}:${g.googleId}`,
			app: "/google" as const,
			title: g.title,
			date: g.date,
			note: [g.startTime?.slice(0, 5) ?? "all day", g.location, calendarName]
				.filter(Boolean)
				.join(" · "),
			href: `/?v=day&d=${g.date}`,
			color: color ?? undefined,
		})),
	];
	// What's ahead first, nearest first; then what's behind, latest first.
	return found.sort((a, b) => {
		const aheadA = a.date >= today;
		const aheadB = b.date >= today;
		if (aheadA !== aheadB) return aheadA ? -1 : 1;
		return aheadA ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date);
	});
}
