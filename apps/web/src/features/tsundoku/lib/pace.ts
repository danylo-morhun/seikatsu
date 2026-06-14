// Reading pace + ETA — computed from recent sessions. Pages only (no time).

export interface SessionLike {
	date: string; // YYYY-MM-DD
	pagesRead: number;
}

export interface Pace {
	pagesPerDay: number;
	daysToFinish: number | null; // null when no pace or already done
}

/**
 * Average pages/day over the span of logged sessions, and an ETA to finish.
 * Span = days between first and last session (min 1) so a single big session
 * doesn't read as an absurd pace.
 */
export function computePace(
	sessions: SessionLike[],
	currentPage: number,
	pageCount: number | null,
): Pace | null {
	if (sessions.length === 0) return null;
	const totalPages = sessions.reduce((sum, s) => sum + s.pagesRead, 0);
	if (totalPages <= 0) return null;

	const dates = sessions.map((s) => s.date).sort();
	const first = new Date(dates[0]);
	const last = new Date(dates[dates.length - 1]);
	const spanDays = Math.max(1, Math.round((last.getTime() - first.getTime()) / 86_400_000) + 1);
	const pagesPerDay = totalPages / spanDays;
	if (pagesPerDay <= 0) return { pagesPerDay: 0, daysToFinish: null };

	let daysToFinish: number | null = null;
	if (pageCount && pageCount > currentPage) {
		daysToFinish = Math.ceil((pageCount - currentPage) / pagesPerDay);
	}
	return { pagesPerDay: Math.round(pagesPerDay), daysToFinish };
}

export function progressPercent(currentPage: number, pageCount: number | null): number | null {
	if (!pageCount || pageCount <= 0) return null;
	return Math.min(100, Math.round((currentPage / pageCount) * 100));
}
