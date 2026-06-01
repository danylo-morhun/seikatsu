"use server";

import { auth } from "@/auth";
import {
	accounts,
	and,
	db,
	eq,
	gte,
	inArray,
	sql,
	transactionEntries,
	transactions,
	workspaces,
} from "@seikatsu/db";

export type AccountDetail = {
	id: string;
	name: string;
	type: "ASSET" | "LIABILITY" | "INCOME" | "EXPENSE";
	currency: string;
	budget: string | null;
	parentId: string | null;
	workspaceId: string;
	balance: number;
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

	const [ws] = await db
		.select({ userId: workspaces.userId })
		.from(workspaces)
		.where(eq(workspaces.id, account.workspaceId))
		.limit(1);

	if (!ws || ws.userId !== session.user.id) throw new Error("Forbidden");

	const [balanceRow] = await db
		.select({ balance: sql<string>`coalesce(sum(${transactionEntries.baseAmount}), 0)` })
		.from(transactionEntries)
		.innerJoin(transactions, eq(transactions.id, transactionEntries.transactionId))
		.where(eq(transactionEntries.accountId, accountId));

	return {
		id: account.id,
		name: account.name,
		type: account.type,
		currency: account.currency,
		budget: account.budget,
		parentId: account.parentId,
		workspaceId: account.workspaceId,
		balance: Number(balanceRow?.balance ?? 0),
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

	const [ws] = await db
		.select({ userId: workspaces.userId })
		.from(workspaces)
		.where(eq(workspaces.id, account.workspaceId))
		.limit(1);

	if (!ws || ws.userId !== session.user.id) throw new Error("Forbidden");

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

export async function getSubAccounts(accountId: string): Promise<AccountDetail[]> {
	const session = await auth();
	if (!session?.user?.id) throw new Error("Unauthorized");

	const [account] = await db
		.select({ workspaceId: accounts.workspaceId })
		.from(accounts)
		.where(eq(accounts.id, accountId))
		.limit(1);

	if (!account) return [];

	const [ws] = await db
		.select({ userId: workspaces.userId })
		.from(workspaces)
		.where(eq(workspaces.id, account.workspaceId))
		.limit(1);

	if (!ws || ws.userId !== session.user.id) throw new Error("Forbidden");

	const children = await db.select().from(accounts).where(eq(accounts.parentId, accountId));

	if (children.length === 0) return [];

	const balanceRows = await db
		.select({
			accountId: transactionEntries.accountId,
			balance: sql<string>`coalesce(sum(${transactionEntries.baseAmount}), 0)`,
		})
		.from(transactionEntries)
		.where(
			inArray(
				transactionEntries.accountId,
				children.map((c) => c.id),
			),
		)
		.groupBy(transactionEntries.accountId);

	const balanceMap = new Map(balanceRows.map((r) => [r.accountId, Number(r.balance)]));

	return children.map((c) => ({
		id: c.id,
		name: c.name,
		type: c.type,
		currency: c.currency,
		budget: c.budget,
		parentId: c.parentId,
		workspaceId: c.workspaceId,
		balance: balanceMap.get(c.id) ?? 0,
	}));
}
