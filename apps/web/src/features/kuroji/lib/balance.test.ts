import { describe, expect, it } from "vitest";
import { displayBalance } from "./balance";

describe("displayBalance", () => {
	it("keeps debit-normal balances as stored", () => {
		expect(displayBalance("ASSET", 120)).toBe(120);
		expect(displayBalance("EXPENSE", 40)).toBe(40);
	});

	it("flips credit-normal balances so their normal side reads positive", () => {
		expect(displayBalance("LIABILITY", -300)).toBe(300);
		expect(displayBalance("INCOME", -5000)).toBe(5000);
	});

	it("shows abnormal balances as negative", () => {
		expect(displayBalance("ASSET", -488.74)).toBe(-488.74);
		expect(displayBalance("LIABILITY", 25)).toBe(-25);
		expect(displayBalance("EXPENSE", -10)).toBe(-10);
	});

	it("never returns negative zero", () => {
		expect(Object.is(displayBalance("LIABILITY", 0), 0)).toBe(true);
		expect(Object.is(displayBalance("INCOME", -0), 0)).toBe(true);
	});
});
