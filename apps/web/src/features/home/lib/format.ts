export function greeting(hour: number) {
	if (hour < 5) return "Good night";
	if (hour < 12) return "Good morning";
	if (hour < 17) return "Good afternoon";
	return "Good evening";
}

/** Whole units: the home reads amounts at a glance; Kuroji keeps the cents. */
export function money(amount: number, currency: string) {
	return new Intl.NumberFormat("pl-PL", {
		style: "currency",
		currency,
		currencyDisplay: "narrowSymbol",
		useGrouping: "always",
		maximumFractionDigits: 0,
	}).format(amount);
}

export const km = (n: number) => `${new Intl.NumberFormat("pl-PL").format(Math.abs(n))} km`;
export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export function longDate(iso: string) {
	return new Intl.DateTimeFormat("en-GB", {
		weekday: "long",
		day: "numeric",
		month: "long",
		timeZone: "UTC",
	}).format(new Date(`${iso}T00:00:00Z`));
}
