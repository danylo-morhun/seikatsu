import { describe, expect, it } from "vitest";
import { type AccountType, accountScope, displayBalance, rollupRoots } from "./balance";

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

describe("rollupRoots", () => {
	const row = (accountId: string, type: AccountType, parentId: string | null = null) => ({
		accountId,
		type,
		parentId,
	});

	it("keeps parents and drops children already rolled into a same-type parent", () => {
		const rows = [row("rent", "EXPENSE"), row("rent-flat", "EXPENSE", "rent")];
		expect(rollupRoots(rows).map((r) => r.accountId)).toEqual(["rent"]);
	});

	it("keeps a child filed under a parent of another type", () => {
		const rows = [row("binance", "ASSET"), row("salary", "INCOME", "binance")];
		expect(rollupRoots(rows).map((r) => r.accountId)).toEqual(["binance", "salary"]);
	});
});

describe("accountScope", () => {
	const row = (accountId: string, parentId: string | null, type: AccountType, hidden = false) => ({
		accountId,
		parentId,
		type,
		hidden,
	});
	const balances = [
		row("bank", null, "ASSET"),
		row("savings", "bank", "ASSET"),
		row("old-card", "bank", "ASSET", true),
		row("salary", "bank", "INCOME"),
		row("food", null, "EXPENSE"),
	];

	it("is the account plus the visible same-type sub-accounts rolled into it", () => {
		expect(accountScope("bank", "ASSET", balances)).toEqual(["bank", "savings"]);
	});

	it("is just the account when nothing rolls into it", () => {
		expect(accountScope("food", "EXPENSE", balances)).toEqual(["food"]);
		expect(accountScope("savings", "ASSET", balances)).toEqual(["savings"]);
	});

	it("keeps the account itself even when it is missing from the balances", () => {
		expect(accountScope("archived", "ASSET", balances)).toEqual(["archived"]);
	});
});
