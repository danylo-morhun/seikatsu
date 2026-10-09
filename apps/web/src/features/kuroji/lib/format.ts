// Fixed locale: `undefined` resolves differently on the server and in the browser,
// so server-rendered and hydrated amounts came out in mixed formats.
export function formatCurrency(amount: number, currency: string) {
	return new Intl.NumberFormat("pl-PL", {
		style: "currency",
		currency,
		currencyDisplay: "narrowSymbol",
		useGrouping: "always",
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	}).format(amount);
}

// Chart axes: the unit is the page's base currency, so ticks stay short ("6K").
export function formatCompactNumber(amount: number) {
	return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(
		amount,
	);
}

/** "2026-08" → "Aug", or "Aug 26" when the series spans more than one year. */
export function monthTickLabels(months: string[]) {
	const multiYear = new Set(months.map((m) => m.slice(0, 4))).size > 1;
	const short = new Intl.DateTimeFormat("en", {
		month: "short",
		...(multiYear ? { year: "2-digit" } : {}),
		timeZone: "UTC",
	});
	return (month: string) => short.format(new Date(`${month.slice(0, 7)}-01T00:00:00Z`));
}
