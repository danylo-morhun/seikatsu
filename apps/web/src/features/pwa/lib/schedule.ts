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

/**
 * The instant a wall-clock `day` + `time` ("HH:MM") falls on in `timeZone`. In a gap (the
 * hour skipped when clocks go forward) it lands just after; in an overlap, on the first one.
 */
export function zonedInstant(day: string, time: string, timeZone: string): Date {
	const [y, mo, d] = day.split("-").map(Number);
	const wall = Date.UTC(y ?? 1970, (mo ?? 1) - 1, d ?? 1) + timeToMinutes(time) * 60_000;
	// The zone's offset at a guess, then once more at the corrected instant (DST edges).
	const offsetAt = (at: number) => {
		const c = localClock(timeZone, new Date(at));
		const [cy, cm, cd] = c.day.split("-").map(Number);
		const local = Date.UTC(cy ?? 1970, (cm ?? 1) - 1, cd ?? 1) + c.minutes * 60_000;
		return local - Math.floor(at / 60_000) * 60_000;
	};
	const first = wall - offsetAt(wall);
	return new Date(wall - offsetAt(first));
}
