// Calendar days as YYYY-MM-DD strings, counted in UTC so no time zone can shift them.

const DAY = 86_400_000;
const ms = (iso: string) => Date.parse(`${iso}T00:00:00Z`);

export function addDays(iso: string, days: number): string {
	return new Date(ms(iso) + days * DAY).toISOString().slice(0, 10);
}

/** Whole days from `from` to `to`: negative when `to` is earlier. */
export function daysBetween(from: string, to: string): number {
	return Math.round((ms(to) - ms(from)) / DAY);
}

const SHORT = new Intl.DateTimeFormat("en", { month: "short", day: "numeric", timeZone: "UTC" });
const LONG = new Intl.DateTimeFormat("en", {
	month: "short",
	day: "numeric",
	year: "numeric",
	timeZone: "UTC",
});

/** "Oct 26", with the year only when it isn't this one. */
export function formatDay(iso: string, today: string): string {
	const date = new Date(ms(iso));
	return iso.slice(0, 4) === today.slice(0, 4) ? SHORT.format(date) : LONG.format(date);
}
