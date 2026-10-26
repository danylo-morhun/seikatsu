// What an iPhone Shortcut's "Transaction" automation hands over, read into a payment.
// The Wallet's amount arrives as text in the phone's locale: "12,50 zł", "PLN 12.50", "€3.20".

import { CURRENCIES, type Currency } from "./constants";
import { parseAmount } from "./transaction-schema";

const SYMBOLS: [string, Currency][] = [
	["zł", "PLN"],
	["€", "EUR"],
	["£", "GBP"],
	["₴", "UAH"],
	["грн", "UAH"],
	["$", "USD"],
	["fr.", "CHF"],
];

/** A Wallet amount as a positive number and its currency, or null when it isn't one. */
export function parseWalletAmount(
	text: string,
	fallbackCurrency: Currency,
): { amount: number; currency: Currency } | null {
	let rest = text.replace(/[\s  ]/g, "").replace(/[−–-]/g, "");
	let currency: Currency | undefined;

	const code = rest.match(/[A-Z]{3}/)?.[0];
	if (code) {
		if (!(CURRENCIES as readonly string[]).includes(code)) return null;
		currency = code as Currency;
		rest = rest.replace(code, "");
	} else {
		for (const [symbol, cur] of SYMBOLS) {
			const at = rest.toLowerCase().indexOf(symbol);
			if (at === -1) continue;
			currency = cur;
			rest = rest.slice(0, at) + rest.slice(at + symbol.length);
			break;
		}
	}

	const amount = parseAmount(rest);
	if (amount === undefined || Number.isNaN(amount) || amount <= 0) return null;
	return { amount, currency: currency ?? fallbackCurrency };
}

/**
 * What a card's bank charges over the official rate, per "PLN>UAH" pair: the median of
 * effective ÷ official rate over saved payments. Ratios of exactly 1 are plain estimates
 * nobody corrected, so they don't count.
 */
export function cardMarkups(samples: { pair: string; ratio: number }[]): Map<string, number> {
	const byPair = new Map<string, number[]>();
	for (const { pair, ratio } of samples) {
		if (!Number.isFinite(ratio) || Math.abs(ratio - 1) < 0.0005) continue;
		byPair.set(pair, [...(byPair.get(pair) ?? []), ratio]);
	}
	const markups = new Map<string, number>();
	for (const [pair, ratios] of byPair) {
		const sorted = [...ratios].sort((a, b) => a - b);
		const mid = Math.floor(sorted.length / 2);
		markups.set(pair, sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2);
	}
	return markups;
}
