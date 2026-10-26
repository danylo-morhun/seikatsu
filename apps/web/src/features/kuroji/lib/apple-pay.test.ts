import { describe, expect, it } from "vitest";
import { cardMarkups, parseWalletAmount } from "./apple-pay";

describe("parseWalletAmount", () => {
	const cases: [string, { amount: number; currency: string } | null][] = [
		["12,50 zł", { amount: 12.5, currency: "PLN" }],
		["1 234,50 zł", { amount: 1234.5, currency: "PLN" }],
		["PLN 12.50", { amount: 12.5, currency: "PLN" }],
		["€3.20", { amount: 3.2, currency: "EUR" }],
		["3,20 €", { amount: 3.2, currency: "EUR" }],
		["$1,234.56", { amount: 1234.56, currency: "USD" }],
		["245,00 ₴", { amount: 245, currency: "UAH" }],
		["245 грн", { amount: 245, currency: "UAH" }],
		["-12,50 zł", { amount: 12.5, currency: "PLN" }],
		["12.5", { amount: 12.5, currency: "PLN" }],
		["JPY 500", null],
		["", null],
		["zł", null],
		["0,00 zł", null],
	];
	it.each(cases)("%s", (text, expected) => {
		expect(parseWalletAmount(text, "PLN")).toEqual(expected);
	});
});

describe("cardMarkups", () => {
	it("takes the median of corrected payments per pair", () => {
		const markups = cardMarkups([
			{ pair: "PLN>UAH", ratio: 1.02 },
			{ pair: "PLN>UAH", ratio: 1.03 },
			{ pair: "PLN>UAH", ratio: 1.01 },
			{ pair: "PLN>UAH", ratio: 1 },
			{ pair: "EUR>UAH", ratio: 1.04 },
			{ pair: "EUR>UAH", ratio: 1.02 },
		]);
		expect(markups.get("PLN>UAH")).toBe(1.02);
		expect(markups.get("EUR>UAH")).toBeCloseTo(1.03);
	});

	it("knows nothing until a payment was corrected", () => {
		expect(cardMarkups([{ pair: "PLN>UAH", ratio: 1 }]).size).toBe(0);
	});
});
