// Events from the browser: run now, or kept in the outbox until back online.

import { deleteEvent, saveEvent } from "@/features/calendar/actions/events";
import type { CalendarEventInput } from "@/features/calendar/lib/schemas";
import { runOrQueue } from "@/features/pwa/lib/run";

const quote = (title: string) => `“${title.length > 40 ? `${title.slice(0, 40)}…` : title}”`;

/** Create or edit: the id is the device's own, so a replay saves the same event. */
export function storeEvent(event: CalendarEventInput) {
	return runOrQueue("calendar.saveEvent", event, `${quote(event.title)} saved`, () =>
		saveEvent(event),
	);
}

export function removeEvent(id: string, title: string) {
	return runOrQueue("calendar.deleteEvent", { id }, `${quote(title)} deleted`, () =>
		deleteEvent({ id }),
	);
}
