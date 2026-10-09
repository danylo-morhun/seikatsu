"use server";

import { auth } from "@/auth";
import { getOwnedWorkspace } from "@/lib/session";
import { accounts, and, db, eq, gte, sql, transactionEntries, transactions } from "@seikatsu/db";

export type AccountDetail = {
	id: string;
	name: string;
	type: "ASSET" | "LIABILITY" | "INCOME" | "EXPENSE";
	currency: string;
	budget: string | null;
	parentId: string | null;
	workspaceId: string;
};

export type AccountActivity = {
	month: string;
	credit: number;
	debit: number;
};

export async function getAccountDetail(accountId: string): Promise<AccountDetail | null> {
	const session = await auth();
	if (!session?.user?.id) throw new Error("Unauthorized");

	const [account] = await db.select().from(accounts).where(eq(accounts.id, accountId)).limit(1);

	if (!account) return null;

	const ws = await getOwnedWorkspace(account.workspaceId);

	if (!ws) throw new Error("Forbidden");

	return {
		id: account.id,
		name: account.name,
		type: account.type,
		currency: account.currency,
		budget: account.budget,
		parentId: account.parentId,
		workspaceId: account.workspaceId,
	};
}

export async function getAccountActivity(
	accountId: string,
	months = 6,
): Promise<AccountActivity[]> {
	const session = await auth();
	if (!session?.user?.id) throw new Error("Unauthorized");

	const [account] = await db
		.select({ workspaceId: accounts.workspaceId })
		.from(accounts)
		.where(eq(accounts.id, accountId))
		.limit(1);

	if (!account) return [];

	const ws = await getOwnedWorkspace(account.workspaceId);

	if (!ws) throw new Error("Forbidden");

	const cutoff = new Date();
	cutoff.setDate(1);
	cutoff.setMonth(cutoff.getMonth() - (months - 1));
	const cutoffDate = cutoff.toISOString().slice(0, 10);

	const rows = await db
		.select({
			month: sql<string>`to_char(${transactions.date}, 'YYYY-MM')`,
			credit: sql<string>`coalesce(sum(case when ${transactionEntries.baseAmount} > 0 then ${transactionEntries.baseAmount} else 0 end), 0)`,
			debit: sql<string>`coalesce(sum(case when ${transactionEntries.baseAmount} < 0 then abs(${transactionEntries.baseAmount}) else 0 end), 0)`,
		})
		.from(transactionEntries)
		.innerJoin(transactions, eq(transactions.id, transactionEntries.transactionId))
		.where(and(eq(transactionEntries.accountId, accountId), gte(transactions.date, cutoffDate)))
		.groupBy(sql`to_char(${transactions.date}, 'YYYY-MM')`)
		.orderBy(sql`to_char(${transactions.date}, 'YYYY-MM')`);

	return rows.map((r) => ({
		month: r.month,
		credit: Number(r.credit),
		debit: Number(r.debit),
	}));
}
