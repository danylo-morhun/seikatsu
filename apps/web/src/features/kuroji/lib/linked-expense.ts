// A Kuroji expense posted by another app (Aisha service, Hoshii purchase) and linked to its row.
// Not a "use server" module: helpers called inside server actions. Callers word the warnings.

import { createTransaction, updateTransaction } from "@/features/kuroji/actions/transactions";
import { db, eq, transactionEntries } from "@seikatsu/db";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type LinkedExpense = { amount: number; currency: string; date: string; description: string };
export type ExpenseAccounts = { walletId: string; categoryId: string };

/**
 * Posts wallet → category, then `link` stores the new id (and anything else) in one transaction.
 * Returns Kuroji's error when it refused the expense.
 */
export async function recordLinkedExpense(
	workspaceId: string,
	k: ExpenseAccounts,
	expense: LinkedExpense,
	link: (tx: Tx, transactionId: string) => Promise<void>,
): Promise<{ error: string } | undefined> {
	const result = await createTransaction({
		workspaceId,
		fromAccountId: k.walletId,
		toAccountId: k.categoryId,
		...expense,
	});
	if ("error" in result) return { error: result.error };
	await db.transaction((tx) => link(tx, result.data.id));
	return undefined;
}

/**
 * Same two accounts as before; amount, currency, date and words follow the source row.
 * "split" when the expense was split in Kuroji (more than two legs) and can't be rewritten.
 */
export async function updateLinkedExpense(
	transactionId: string,
	expense: LinkedExpense,
): Promise<"split" | { error: string } | undefined> {
	const legs = await db
		.select({ accountId: transactionEntries.accountId, amount: transactionEntries.amount })
		.from(transactionEntries)
		.where(eq(transactionEntries.transactionId, transactionId));
	const from = legs.find((l) => Number(l.amount) < 0);
	const to = legs.find((l) => Number(l.amount) > 0);
	if (legs.length !== 2 || !from || !to) return "split";
	const result = await updateTransaction({
		transactionId,
		fromAccountId: from.accountId,
		toAccountId: to.accountId,
		...expense,
	});
	return "error" in result ? { error: result.error } : undefined;
}
