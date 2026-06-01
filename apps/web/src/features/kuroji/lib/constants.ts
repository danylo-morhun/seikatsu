export const CURRENCIES = ["PLN", "EUR", "USD", "CHF", "GBP"] as const;
export type Currency = (typeof CURRENCIES)[number];

export function toCurrency(c: string): Currency {
	return (CURRENCIES as readonly string[]).includes(c) ? (c as Currency) : "PLN";
}
