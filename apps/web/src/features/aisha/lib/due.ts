// Pure due-date math for Aisha. No DB, no clock — callers pass `today`.
// Dates are YYYY-MM-DD strings, compared as UTC days so DST never shifts a day.

export type DueStatus = "ok" | "soon" | "overdue" | "unknown";

/** Warn this many km / days before something is due. */
export const SOON_KM = 1000;
export const SOON_DAYS = 30;

const DAY_MS = 86_400_000;

function toDay(iso: string): number {
	const [y, m, d] = iso.split("-").map(Number);
	return Date.UTC(y, m - 1, d) / DAY_MS;
}

function fromDay(day: number): string {
	return new Date(day * DAY_MS).toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string): number {
	return toDay(to) - toDay(from);
}

export function addDays(iso: string, days: number): string {
	return fromDay(toDay(iso) + days);
}

/** Calendar month add, clamped to month end (Jan 31 + 1 month = Feb 28/29). */
export function addMonths(iso: string, months: number): string {
	const [y, m, d] = iso.split("-").map(Number);
	const target = new Date(Date.UTC(y, m - 1 + months, 1));
	const lastDay = new Date(
		Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
	).getUTCDate();
	target.setUTCDate(Math.min(d, lastDay));
	return target.toISOString().slice(0, 10);
}

export interface Reading {
	date: string;
	km: number;
}

/**
 * Average km per day from odometer readings. Uses the span from the oldest reading
 * within `windowDays` of the newest one, so old idle periods don't drag it down.
 * Returns null when there isn't at least a week of data to go on.
 */
export function kmPerDay(readings: Reading[], windowDays = 180): number | null {
	if (readings.length < 2) return null;
	const sorted = [...readings].sort((a, b) => daysBetween(b.date, a.date));
	const last = sorted[sorted.length - 1];
	const first = sorted.find((r) => daysBetween(r.date, last.date) <= windowDays) ?? sorted[0];
	const days = daysBetween(first.date, last.date);
	if (days < 7) return null;
	const km = last.km - first.km;
	return km > 0 ? km / days : null;
}

export interface MaintenanceDueInput {
	intervalKm: number | null;
	intervalMonths: number | null;
	lastDone: Reading | null;
	currentKm: number;
	today: string;
	kmPerDay: number | null;
}

export interface MaintenanceDue {
	status: DueStatus;
	dueKm: number | null;
	kmLeft: number | null;
	dueDate: string | null;
	daysLeft: number | null;
	/** Best guess of when it's due: the earlier of the time limit and the km limit at current pace. */
	estimatedDate: string | null;
}

export function maintenanceDue(input: MaintenanceDueInput): MaintenanceDue {
	const { intervalKm, intervalMonths, lastDone, currentKm, today } = input;
	if (!lastDone) {
		return {
			status: "unknown",
			dueKm: null,
			kmLeft: null,
			dueDate: null,
			daysLeft: null,
			estimatedDate: null,
		};
	}

	const dueKm = intervalKm != null ? lastDone.km + intervalKm : null;
	const kmLeft = dueKm != null ? dueKm - currentKm : null;
	const dueDate = intervalMonths != null ? addMonths(lastDone.date, intervalMonths) : null;
	const daysLeft = dueDate != null ? daysBetween(today, dueDate) : null;

	const kmDate =
		kmLeft != null && input.kmPerDay
			? addDays(today, Math.max(0, Math.floor(kmLeft / input.kmPerDay)))
			: null;
	const candidates = [dueDate, kmDate].filter((d): d is string => d != null);
	const estimatedDate = candidates.length
		? candidates.reduce((a, b) => (daysBetween(a, b) < 0 ? b : a))
		: null;

	return {
		status: statusFor(kmLeft, daysLeft),
		dueKm,
		kmLeft,
		dueDate,
		daysLeft,
		estimatedDate,
	};
}

export function documentDue(expiresOn: string, today: string) {
	const daysLeft = daysBetween(today, expiresOn);
	return { daysLeft, status: statusFor(null, daysLeft) };
}

function statusFor(kmLeft: number | null, daysLeft: number | null): DueStatus {
	if (kmLeft == null && daysLeft == null) return "unknown";
	if ((kmLeft != null && kmLeft <= 0) || (daysLeft != null && daysLeft <= 0)) return "overdue";
	if ((kmLeft != null && kmLeft <= SOON_KM) || (daysLeft != null && daysLeft <= SOON_DAYS)) {
		return "soon";
	}
	return "ok";
}

const STATUS_RANK: Record<DueStatus, number> = { overdue: 0, soon: 1, unknown: 2, ok: 3 };

/** Most urgent first; ties broken by whichever is estimated sooner. */
export function compareUrgency(
	a: { status: DueStatus; estimatedDate: string | null },
	b: { status: DueStatus; estimatedDate: string | null },
): number {
	const rank = STATUS_RANK[a.status] - STATUS_RANK[b.status];
	if (rank !== 0) return rank;
	if (a.estimatedDate && b.estimatedDate) return daysBetween(b.estimatedDate, a.estimatedDate);
	return a.estimatedDate ? -1 : b.estimatedDate ? 1 : 0;
}
