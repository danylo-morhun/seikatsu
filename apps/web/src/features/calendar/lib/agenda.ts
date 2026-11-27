// Server-only: the day's events (the user's own and the shown Google calendars'), as the
// agenda hands them to Today, My day, the morning push and the tools. Takes a workspace id,
// so a push can read it without a session.

import { readGoogleEvents } from "@/features/calendar/google/sync";
import { readEvents } from "@/features/calendar/lib/data";
import { eventRows, googleRows } from "@/features/calendar/lib/events";

/** An event on the day, as a row of the day's list. */
export type EventToday = {
	key: string;
	/** Own events (予) or a Google calendar's (外). */
	source: "/calendar" | "/google";
	title: string;
	/** "HH:MM" it starts at; none = all day. */
	time?: string;
	end?: string;
	/** Where, which calendar, "day 2 of 3"… */
	note: string;
	/** "#rrggbb": a Google calendar's own colour. */
	color?: string;
};

export async function readEventsAgenda(workspaceId: string, day: string): Promise<EventToday[]> {
	const [own, google] = await Promise.all([
		readEvents(workspaceId, day, day),
		readGoogleEvents(workspaceId, day, day),
	]);
	const rows = [
		...(eventRows(own, [day]).get(day) ?? []),
		...(googleRows(google, [day]).get(day) ?? []),
	];
	return rows
		.map((r) => ({
			key: r.key,
			source: r.app === "/google" ? ("/google" as const) : ("/calendar" as const),
			title: r.title,
			time: r.time,
			end: r.end,
			note: r.note ?? "",
			color: r.color,
		}))
		.sort((a, b) => (a.time ?? "").localeCompare(b.time ?? ""));
}
