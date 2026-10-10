import {
	addDays,
	differenceInCalendarDays,
	differenceInCalendarMonths,
	endOfMonth,
	format,
	isSameDay,
	startOfMonth,
	subMonths,
} from "date-fns";

export function parseLocal(str: string): Date {
	const [y, m, d] = str.split("-").map(Number);
	return new Date(y, m - 1, d);
}

export function buildPeriodLabel(
	from: string | undefined,
	to: string | undefined,
	isAllTime = false,
): string {
	if (isAllTime) return "All time";
	if (!from && !to) return "This month";
	if (!from || !to) return "Custom range";
	const f = parseLocal(from);
	const t = parseLocal(to);
	const isMonthStart = isSameDay(f, startOfMonth(f));
	const isMonthEnd = isSameDay(t, endOfMonth(t));
	const singleMonth = f.getFullYear() === t.getFullYear() && f.getMonth() === t.getMonth();

	if (isMonthStart && isMonthEnd && singleMonth) return format(f, "MMMM yyyy");
	if (isMonthStart && isMonthEnd) {
		return f.getFullYear() === t.getFullYear()
			? `${format(f, "MMM")} – ${format(t, "MMM yyyy")}`
			: `${format(f, "MMM yyyy")} – ${format(t, "MMM yyyy")}`;
	}
	return `${format(f, "MMM d")} – ${format(t, "MMM d, yyyy")}`;
}

/** The range of the same length just before `from`–`to`; whole months stay whole months. */
export function previousRange(from: string, to: string): { from: string; to: string } {
	const f = parseLocal(from);
	const t = parseLocal(to);
	const ymd = (d: Date) => format(d, "yyyy-MM-dd");
	if (isSameDay(f, startOfMonth(f)) && isSameDay(t, endOfMonth(t))) {
		const months = differenceInCalendarMonths(t, f) + 1;
		return { from: ymd(subMonths(f, months)), to: ymd(endOfMonth(subMonths(t, months))) };
	}
	const days = differenceInCalendarDays(t, f) + 1;
	return { from: ymd(addDays(f, -days)), to: ymd(addDays(t, -days)) };
}

// Kuroji's date style, one family: month name first, the year only outside today's year.
// date-fns formats in English on server and browser alike, so hydration matches.

/** Today in the browser's local calendar (YYYY-MM-DD); server code uses getUserToday(). */
export function localToday(): string {
	return format(new Date(), "yyyy-MM-dd");
}

/** "Sep 11", or "Sep 11, 2025" outside today's year. */
export function formatShortDate(iso: string, today: string): string {
	const d = parseLocal(iso);
	return iso.slice(0, 4) === today.slice(0, 4) ? format(d, "MMM d") : format(d, "MMM d, yyyy");
}

/** "Thu, Sep 10", or "Thu, Sep 10, 2025" outside today's year: day headers. */
export function formatDayDate(iso: string, today: string): string {
	return `${format(parseLocal(iso), "EEE")}, ${formatShortDate(iso, today)}`;
}

/** "Sep 11, 08:57", or "Sep 11, 2025, 08:57" outside this year: a moment, in local time. */
export function formatDateTime(at: Date, now: Date = new Date()): string {
	return at.getFullYear() === now.getFullYear()
		? format(at, "MMM d, HH:mm")
		: format(at, "MMM d, yyyy, HH:mm");
}
