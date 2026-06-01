export function formatCurrency(amount: number, currency: string) {
	return new Intl.NumberFormat(undefined, {
		style: "currency",
		currency,
		currencyDisplay: "narrowSymbol",
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	}).format(amount);
}
