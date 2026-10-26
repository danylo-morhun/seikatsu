/** "1 299 zł", "€189", "12,99 zł": decimals only when there are any. `whole` rounds. */
export function formatMoney(amount: number, currency: string, whole = false): string {
	const value = whole ? Math.round(amount) : amount;
	const digits = value % 1 === 0 ? 0 : 2;
	return new Intl.NumberFormat("pl-PL", {
		style: "currency",
		currency,
		currencyDisplay: "narrowSymbol",
		useGrouping: "always",
		minimumFractionDigits: digits,
		maximumFractionDigits: digits,
	}).format(value);
}

/** "1 299" (no currency), for figures with the unit beside them. */
export function formatNumber(amount: number): string {
	return new Intl.NumberFormat("pl-PL", { useGrouping: "always", maximumFractionDigits: 0 }).format(
		Math.round(amount),
	);
}

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
