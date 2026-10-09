export type AccountType = "ASSET" | "LIABILITY" | "INCOME" | "EXPENSE";

// Income and liabilities are credit-normal: the ledger stores them negative.
export function isCreditNormal(type: AccountType) {
	return type === "INCOME" || type === "LIABILITY";
}

/**
 * Ledger balance → the number a person expects to read: positive when the account
 * holds its normal balance (money owned, debt owed, income earned, money spent),
 * negative only when it is abnormal (overdrawn asset, overpaid card, refund > spend).
 */
export function displayBalance(type: AccountType, ledgerBalance: number) {
	const value = isCreditNormal(type) ? -ledgerBalance : ledgerBalance;
	// Avoid rendering "-0,00".
	return value === 0 ? 0 : value;
}

/**
 * Accounts whose balance is not already counted in a parent's rollup: no parent, or a
 * parent of another type (an income category filed under the asset it pays into).
 * Summing these per type counts every entry exactly once.
 */
export function rollupRoots<
	T extends { accountId: string; parentId: string | null; type: AccountType },
>(balances: T[]): T[] {
	const typeById = new Map(balances.map((b) => [b.accountId, b.type]));
	return balances.filter((b) => !b.parentId || typeById.get(b.parentId) !== b.type);
}

/**
 * The accounts an account's balance covers: itself plus the visible sub-accounts of
 * its own type that roll into it. Its transaction list, export and chart use the same.
 */
export function accountScope(
	accountId: string,
	type: AccountType,
	balances: { accountId: string; parentId: string | null; type: AccountType; hidden: boolean }[],
): string[] {
	const rolledUp = balances.filter((b) => b.parentId === accountId && !b.hidden && b.type === type);
	return [accountId, ...rolledUp.map((b) => b.accountId)];
}
