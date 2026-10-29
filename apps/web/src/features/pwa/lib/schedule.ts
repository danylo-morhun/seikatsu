// When a scheduled notification is due, in the user's zone. Pure — the notify cron and tests
// both pass the clock in.

export interface LocalClock {
	/** YYYY-MM-DD in the user's zone. */
	day: string;
	/** Minutes since local midnight. */
	minutes: number;
	/** 1 = Monday … 7 = Sunday. */
	weekday: number;
}

const WEEKDAYS: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

export function localClock(timeZone: string, at: Date = new Date()): LocalClock {
	const parts = Object.fromEntries(
		new Intl.DateTimeFormat("en-CA", {
			timeZone,
			year: "numeric",
			month: "2-digit",
			day: "2-digit",
			hour: "2-digit",
			minute: "2-digit",
			weekday: "short",
			hourCycle: "h23",
		})
			.formatToParts(at)
			.map((p) => [p.type, p.value]),
	);
	return {
		day: `${parts.year}-${parts.month}-${parts.day}`,
		minutes: Number(parts.hour) * 60 + Number(parts.minute),
		weekday: WEEKDAYS[parts.weekday] ?? 1,
	};
}

/** "HH:MM" or "HH:MM:SS" (Postgres `time`) → minutes since midnight. */
export function timeToMinutes(time: string): number {
	const [h, m] = time.split(":").map(Number);
	return (h ?? 0) * 60 + (m ?? 0);
}

/**
 * The cron runs every 15 minutes but a run may start late or be skipped, so a time stays
 * due for an hour after it passes; the notification log makes sure it's sent once.
 */
export const DUE_WINDOW_MINUTES = 60;

export function isTimeDue(time: string, clock: LocalClock): boolean {
	const start = timeToMinutes(time);
	return clock.minutes >= start && clock.minutes < start + DUE_WINDOW_MINUTES;
}

/** A zone the runtime knows, else UTC (a stale or hand-typed zone must not crash the cron). */
export function safeTimeZone(zone: string | null | undefined): string {
	if (!zone) return "UTC";
	try {
		new Intl.DateTimeFormat("en-US", { timeZone: zone });
		return zone;
	} catch {
		return "UTC";
	}
}
