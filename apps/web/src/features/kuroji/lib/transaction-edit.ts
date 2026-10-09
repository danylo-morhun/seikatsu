import { toCurrency } from "./constants";
import type { AddTransactionFormValues, SplitItem } from "./transaction-schema";

/** One stored entry of a transaction. Debits carry a negative amount. */
export type Leg = {
	accountId: string;
	accountType: string;
	amount: string;
	currency: string;
	baseAmount: string;
};

const abs = (value: string) => Math.abs(Number(value));
const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Form values to edit a saved transaction: one wallet leg against one or more category legs.
 * Null when the transaction has several legs on both sides, which the form can't show.
 */
export function editFormValues(txn: {
	date: string;
	description: string | null;
	legs: Leg[];
}): AddTransactionFormValues | null {
	const debits = txn.legs.filter((l) => Number(l.amount) < 0);
	const credits = txn.legs.filter((l) => Number(l.amount) >= 0);
	if (debits.length === 0 || credits.length === 0) return null;
	if (debits.length > 1 && credits.length > 1) return null;
	const base = { description: txn.description ?? undefined, date: txn.date };

	if (debits.length === 1 && credits.length === 1) {
		// The amount comes from the wallet leg, so the wallet keeps its exact native amount.
		const [from] = debits;
		const [to] = credits;
		if (to.accountType === "EXPENSE") {
			return {
				...base,
				txType: "expense",
				currency: toCurrency(from.currency),
				walletId: from.accountId,
				splits: [{ categoryId: to.accountId, amount: abs(from.amount) }],
			};
		}
		if (from.accountType === "INCOME") {
			return {
				...base,
				txType: "income",
				currency: toCurrency(to.currency),
				walletId: to.accountId,
				splits: [{ categoryId: from.accountId, amount: abs(to.amount) }],
			};
		}
		return {
			...base,
			txType: "transfer",
			currency: toCurrency(from.currency),
			fromWalletId: from.accountId,
			toWalletId: to.accountId,
			amount: abs(from.amount),
			received: to.currency !== from.currency ? abs(to.amount) : undefined,
		};
	}

	// A split: the lone leg is the wallet, the other side holds the categories.
	const isExpense = debits.length === 1;
	const wallet = isExpense ? debits[0] : credits[0];
	return {
		...base,
		txType: isExpense ? "expense" : "income",
		currency: toCurrency(wallet.currency),
		walletId: wallet.accountId,
		splits: splitItems(wallet, isExpense ? credits : debits),
	};
}

/**
 * Category amounts in the wallet's currency. Legs in another currency take their share of
 * the wallet total by base value; the last one takes the rounding remainder.
 */
function splitItems(wallet: Leg, categories: Leg[]): SplitItem[] {
	const total = abs(wallet.amount);
	const totalBase = categories.reduce((sum, l) => sum + abs(l.baseAmount), 0) || 1;
	const converted = categories.some((l) => l.currency !== wallet.currency);
	const amounts = categories.map((l) =>
		converted ? round2((total * abs(l.baseAmount)) / totalBase) : abs(l.amount),
	);
	if (converted) {
		const others = amounts.slice(0, -1).reduce((sum, a) => sum + a, 0);
		amounts[amounts.length - 1] = round2(total - others);
	}
	return categories.map((l, i) => ({ categoryId: l.accountId, amount: amounts[i] }));
}
