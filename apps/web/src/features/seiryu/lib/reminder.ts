// When a card's reminder goes off. Pure: the server saves the instant (`remind_at`), the
// notify cron only compares it with now.

import { zonedInstant } from "@/features/pwa/lib/schedule";

/** A card with a date but no time is reminded about at this local time. */
export const DAY_START = "09:00";

/** Minutes before the due moment. */
export const REMIND_OPTIONS = [
	{ minutes: 0, label: "At the time" },
	{ minutes: 15, label: "15 min before" },
	{ minutes: 60, label: "1 hour before" },
	{ minutes: 1440, label: "1 day before" },
] as const;

/** Snoozing from the notification: back in an hour. */
export const SNOOZE_MINUTES = 60;

export const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Postgres `time` ("15:00:00") → "15:00"; null stays null. */
export const shortTime = (time: string | null): string | null => time?.slice(0, 5) ?? null;

export interface Due {
	dueDate: string | null;
	dueTime: string | null;
	remindMinutes: number | null;
}

/** The instant to remind at, or null when there's nothing to remind about. */
export function reminderAt(due: Due, timeZone: string): Date | null {
	if (!due.dueDate || due.remindMinutes == null) return null;
	const moment = zonedInstant(due.dueDate, due.dueTime ?? DAY_START, timeZone);
	return new Date(moment.getTime() - due.remindMinutes * 60_000);
}

/**
 * The due fields after an edit: no date means no time and no reminder; a time set on a card
 * with no reminder yet turns one on at the time (a time is usually set to be told).
 */
export function nextDue(current: Due, edit: Partial<Due>): Due {
	const pick = <K extends keyof Due>(k: K) =>
		(edit[k] !== undefined ? edit[k] : current[k]) as Due[K];
	const next = {
		dueDate: pick("dueDate"),
		dueTime: pick("dueTime"),
		remindMinutes: pick("remindMinutes"),
	};
	if (!next.dueDate) return { dueDate: null, dueTime: null, remindMinutes: null };
	if (
		edit.dueTime &&
		!current.dueTime &&
		next.remindMinutes == null &&
		edit.remindMinutes === undefined
	)
		return { ...next, remindMinutes: 0 };
	return next;
}

/** "Today 15:00", "Tomorrow", "Fri 14 Nov 09:30": how a reminder names the due moment. */
export function dueLabel(dueDate: string, dueTime: string | null, today: string, tomorrow: string) {
	const day =
		dueDate === today
			? "Today"
			: dueDate === tomorrow
				? "Tomorrow"
				: new Date(`${dueDate}T00:00:00Z`).toLocaleDateString("en-GB", {
						weekday: "short",
						day: "numeric",
						month: "short",
						timeZone: "UTC",
					});
	return dueTime ? `${day} ${dueTime}` : day;
}
