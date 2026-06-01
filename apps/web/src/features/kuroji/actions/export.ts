"use server";

import { auth } from "@/auth";
import {
	accounts,
	and,
	db,
	desc,
	eq,
	gte,
	ilike,
	inArray,
	lte,
	transactionEntries,
	transactions,
	workspaces,
} from "@seikatsu/db";

export async function exportTransactionsCsv(
	workspaceId: string,
	from: string | undefined,
	to: string | undefined,
	accountId: string | undefined,
	q: string | undefined,
): Promise<{ error: string } | { csv: string }> {
	const session = await auth();
	if (!session?.user?.id) return { error: "Unauthorized" };

	const [ws] = await db
		.select({ userId: workspaces.userId })
		.from(workspaces)
		.where(eq(workspaces.id, workspaceId))
		.limit(1);

	if (!ws || ws.userId !== session.user.id) return { error: "Forbidden" };

	const accountSubquery = accountId
		? db
				.selectDistinct({ id: transactionEntries.transactionId })
				.from(transactionEntries)
				.where(eq(transactionEntries.accountId, accountId))
		: undefined;

	const rows = await db.query.transactions.findMany({
		where: and(
			eq(transactions.workspaceId, workspaceId),
			from ? gte(transactions.date, from) : undefined,
			to ? lte(transactions.date, to) : undefined,
			q ? ilike(transactions.description, `%${q}%`) : undefined,
			accountSubquery ? inArray(transactions.id, accountSubquery) : undefined,
		),
		orderBy: [desc(transactions.date), desc(transactions.createdAt)],
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
