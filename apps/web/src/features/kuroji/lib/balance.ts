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
