// Dates as Kyuu shows them. Days are YYYY-MM-DD calendar days, read without a time zone.

const SHORT = new Intl.DateTimeFormat("en", { month: "short", day: "numeric", timeZone: "UTC" });
const LONG = new Intl.DateTimeFormat("en", {
	month: "short",
	day: "numeric",
	year: "numeric",
	timeZone: "UTC",
});
const WEEKDAY = new Intl.DateTimeFormat("en", { weekday: "short", timeZone: "UTC" });

const at = (day: string) => new Date(`${day}T00:00:00Z`);

/** "Oct 16", with the year only when it isn't this year's. */
export function formatDay(day: string, today: string): string {
	return day.slice(0, 4) === today.slice(0, 4) ? SHORT.format(at(day)) : LONG.format(at(day));
}

/** For what's booked: "Today", "Tomorrow", "Thu, Oct 22" — and the time, if set. */
export function formatWhen(day: string, time: string | null, today: string): string {
	const tomorrow = new Date(at(today).getTime() + 86_400_000).toISOString().slice(0, 10);
	const name =
		day === today
			? "Today"
			: day === tomorrow
				? "Tomorrow"
				: `${WEEKDAY.format(at(day))}, ${formatDay(day, today)}`;
	return time ? `${name} · ${time}` : name;
}

/** "3d", "2w", "4mo": how long something has waited. */
export function formatAge(days: number): string {
	if (days < 14) return `${days}d`;
	if (days < 60) return `${Math.floor(days / 7)}w`;
	return `${Math.floor(days / 30)}mo`;
}

/** The user's calendar day in this browser. */
export function localToday(): string {
	const d = new Date();
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
