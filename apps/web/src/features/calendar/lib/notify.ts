// An event's reminder: one push in the 15 minutes before a timed event starts (the cron runs
// every 15 minutes, so exactly one run falls in them), for the user's own events and the shown
// Google calendars' alike. All-day events are in the morning's push instead.

import { type EventToday, readEventsAgenda } from "@/features/calendar/lib/agenda";
import type { Notifier } from "@/features/pwa/lib/notifiers";
import { sendOnce } from "@/features/pwa/lib/push";
import { type LocalClock, timeToMinutes } from "@/features/pwa/lib/schedule";

/** How long before its start an event is pushed. */
export const REMIND_BEFORE = 15;

/** The day's timed events whose reminder is due now. Pure. */
export function dueReminders(events: EventToday[], clock: LocalClock): EventToday[] {
	return events.filter((e) => {
		if (!e.time) return false;
		const start = timeToMinutes(e.time);
		return clock.minutes >= start - REMIND_BEFORE && clock.minutes < start;
	});
}

export const notifyCalendar: Notifier = async ({ workspaceId, prefs, clock }) => {
	if (!prefs.eventReminders) return 0;
	const due = dueReminders(await readEventsAgenda(workspaceId, clock.day), clock);
	let sent = 0;
	for (const e of due) {
		const ok = await sendOnce(workspaceId, `calendar:${e.key}:${e.time}`, {
			title: e.title,
			body: e.note || (e.end ? `${e.time}–${e.end}` : (e.time ?? "")),
			url: `/?v=day&d=${clock.day}`,
			tag: `calendar-${e.key}`,
		});
		if (ok) sent++;
	}
	return sent;
};
