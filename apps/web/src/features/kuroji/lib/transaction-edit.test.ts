import { describe, expect, it } from "vitest";
import { type Leg, editFormValues } from "./transaction-edit";

const leg = (
	accountId: string,
	accountType: string,
	amount: number,
	currency = "PLN",
	baseAmount = amount,
): Leg => ({
	accountId,
	accountType,
	amount: amount.toFixed(4),
	currency,
	baseAmount: baseAmount.toFixed(4),
});

const txn = (legs: Leg[]) => ({ date: "2026-09-01", description: "Market", legs });

describe("editFormValues", () => {
	it("loads every category of an expense split", () => {
		const values = editFormValues(
			txn([leg("card", "ASSET", -15), leg("food", "EXPENSE", 10), leg("cafe", "EXPENSE", 5)]),
		);
		expect(values).toEqual({
			txType: "expense",
			description: "Market",
			date: "2026-09-01",
			currency: "PLN",
			walletId: "card",
			splits: [
				{ categoryId: "food", amount: 10 },
				{ categoryId: "cafe", amount: 5 },
			],
		});
	});

	it("loads every source of an income split", () => {
		const values = editFormValues(
			txn([
				leg("salary", "INCOME", -900),
				leg("bonus", "INCOME", -100),
				leg("bank", "ASSET", 1000),
			]),
		);
		expect(values).toMatchObject({
			txType: "income",
			walletId: "bank",
			splits: [
				{ categoryId: "salary", amount: 900 },
				{ categoryId: "bonus", amount: 100 },
			],
		});
	});

	it("shares the wallet total across legs in another currency, remainder last", () => {
		const values = editFormValues(
			txn([
				leg("card", "ASSET", -10, "EUR", -43),
				leg("food", "EXPENSE", 14.33, "PLN"),
				leg("cafe", "EXPENSE", 14.33, "PLN"),
				leg("bar", "EXPENSE", 14.34, "PLN"),
			]),
		);
		const splits = values && "splits" in values ? values.splits : [];
		expect(splits.map((s) => s.amount)).toEqual([3.33, 3.33, 3.34]);
		expect(values?.currency).toBe("EUR");
	});

	it("keeps a plain expense as one category with the wallet amount", () => {
		expect(
			editFormValues(txn([leg("card", "ASSET", -12, "EUR", -51), leg("food", "EXPENSE", 51)])),
		).toMatchObject({
			txType: "expense",
			currency: "EUR",
			walletId: "card",
			splits: [{ categoryId: "food", amount: 12 }],
		});
	});

	it("loads a cross-currency transfer with the received amount", () => {
		expect(
			editFormValues(txn([leg("eur", "ASSET", -400, "EUR", -1700), leg("pln", "ASSET", 1700)])),
		).toMatchObject({
			txType: "transfer",
			fromWalletId: "eur",
			toWalletId: "pln",
			amount: 400,
			currency: "EUR",
			received: 1700,
		});
	});

	it("refuses several legs on both sides", () => {
		expect(
			editFormValues(
				txn([
					leg("a", "ASSET", -5),
					leg("b", "ASSET", -5),
					leg("c", "EXPENSE", 5),
					leg("d", "EXPENSE", 5),
				]),
			),
		).toBeNull();
	});
});
