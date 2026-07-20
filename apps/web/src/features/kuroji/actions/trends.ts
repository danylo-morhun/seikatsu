"use server";

import { auth } from "@/auth";
import {
	accounts,
	and,
	db,
	eq,
	gte,
	inArray,
	lte,
	ne,
	sql,
	transactionEntries,
	transactions,
	workspaces,
} from "@seikatsu/db";

export type MonthlyTrend = {
	month: string; // YYYY-MM
	income: number;
	expenses: number;
};

export async function getMonthlyTrends(
	workspaceId: string,
	from?: string,
	to?: string,
	months = 6,
): Promise<MonthlyTrend[]> {
	const session = await auth();
	if (!session?.user?.id) throw new Error("Unauthorized");

	const [ws] = await db
		.select({ userId: workspaces.userId })
		.from(workspaces)
		.where(eq(workspaces.id, workspaceId))
		.limit(1);

	if (!ws || ws.userId !== session.user.id) throw new Error("Forbidden");

	let cutoffDate: string;
	if (from) {
		cutoffDate = `${from.slice(0, 7)}-01`;
	} else {
		const cutoff = new Date();
		cutoff.setDate(1);
		cutoff.setMonth(cutoff.getMonth() - (months - 1));
		cutoffDate = cutoff.toISOString().slice(0, 10);
	}

	const rows = await db
		.select({
			month: sql<string>`to_char(${transactions.date}, 'YYYY-MM')`,
			type: accounts.type,
			total: sql<string>`coalesce(sum(${transactionEntries.baseAmount}), 0)`,
		})
		.from(accounts)
		.innerJoin(transactionEntries, eq(transactionEntries.accountId, accounts.id))
		.innerJoin(transactions, eq(transactions.id, transactionEntries.transactionId))
		.where(
			and(
				eq(accounts.workspaceId, workspaceId),
				inArray(accounts.type, ["INCOME", "EXPENSE"]),
				ne(accounts.name, "Opening Balance"),
				ne(accounts.hiddenFromDashboard, true),
				gte(transactions.date, cutoffDate),
				to ? lte(transactions.date, to) : undefined,
			),
		)
		.groupBy(sql`to_char(${transactions.date}, 'YYYY-MM')`, accounts.type)
		.orderBy(sql`to_char(${transactions.date}, 'YYYY-MM')`);

	const byMonth = new Map<string, MonthlyTrend>();

	for (const row of rows) {
		if (!byMonth.has(row.month)) {
			byMonth.set(row.month, { month: row.month, income: 0, expenses: 0 });
		}
		const entry = byMonth.get(row.month)!;
		if (row.type === "INCOME") entry.income = Math.abs(Number(row.total));
		if (row.type === "EXPENSE") entry.expenses = Math.abs(Number(row.total));
	}

	return Array.from(byMonth.values());
}
