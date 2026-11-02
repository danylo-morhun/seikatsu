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
