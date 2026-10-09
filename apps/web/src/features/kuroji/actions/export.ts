"use server";

import { auth } from "@/auth";
import {
	type TransactionFilters,
	transactionFiltersSchema,
} from "@/features/kuroji/lib/transaction-filters";
import { transactionOrder, transactionWhere } from "@/features/kuroji/lib/transaction-query";
import { getOwnedWorkspace } from "@/lib/session";
import { db } from "@seikatsu/db";

/** The list's rows as CSV: same filters, same order, up to 10,000 rows. */
export async function exportTransactionsCsv(
	workspaceId: string,
	filters: TransactionFilters,
): Promise<{ error: string } | { csv: string }> {
	const session = await auth();
	if (!session?.user?.id) return { error: "Unauthorized" };

	const ws = await getOwnedWorkspace(workspaceId);

	if (!ws) return { error: "Forbidden" };

	const parsed = transactionFiltersSchema.safeParse(filters);
	if (!parsed.success) return { error: "Invalid filters" };

	const rows = await db.query.transactions.findMany({
		where: transactionWhere(workspaceId, parsed.data),
		orderBy: transactionOrder(parsed.data),
		limit: 10_000,
		with: { entries: { with: { account: true } } },
	});

	const lines = ["Date,Description,From,To,Amount,Currency,Base Amount"];

	for (const txn of rows) {
		const fromEntries = txn.entries.filter((e) => Number(e.baseAmount) < 0);
		const toEntries = txn.entries.filter((e) => Number(e.baseAmount) > 0);
		const fromEntry = fromEntries[0];
		const toEntry = toEntries[0];
		const totalAmount = toEntries.reduce((s, e) => s + Number(e.amount), 0);
		const totalBase = toEntries.reduce((s, e) => s + Number(e.baseAmount), 0);

		const cell = (v: string | null | undefined) => `"${(v ?? "").replace(/"/g, '""')}"`;

		lines.push(
			[
				txn.date,
				cell(txn.description),
				fromEntries.length > 1 ? `"Split (${fromEntries.length})"` : cell(fromEntry?.account?.name),
				toEntries.length > 1 ? `"Split (${toEntries.length})"` : cell(toEntry?.account?.name),
				totalAmount.toFixed(2),
				toEntry?.currency ?? "",
				totalBase.toFixed(4),
			].join(","),
		);
	}

	return { csv: lines.join("\n") };
}
