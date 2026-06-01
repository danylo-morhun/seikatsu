import { endOfMonth, format, isSameDay, startOfMonth } from "date-fns";

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
