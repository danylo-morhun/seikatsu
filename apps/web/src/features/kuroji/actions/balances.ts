"use server";

import { auth } from "@/auth";
import {
	accounts,
	and,
	db,
	eq,
	isNull,
	sql,
	transactionEntries,
	transactions,
	workspaces,
} from "@seikatsu/db";

export type AccountBalance = {
	accountId: string;
	parentId: string | null;
	name: string;
	type: "ASSET" | "LIABILITY" | "INCOME" | "EXPENSE";
	currency: string;
	balance: string;
	nativeBalance: string;
	hidden: boolean;
};

export async function getBalances(
	workspaceId: string,
	from: string | undefined,
	to: string | undefined,
): Promise<AccountBalance[]> {
	const session = await auth();
	if (!session?.user?.id) throw new Error("Unauthorized");

	const [ws] = await db
		.select({ userId: workspaces.userId })
		.from(workspaces)
		.where(eq(workspaces.id, workspaceId))
		.limit(1);

	if (!ws || ws.userId !== session.user.id) throw new Error("Forbidden");

	const assetLiabDateClause = to
		? sql`and (${transactions.date} is null or ${transactions.date} <= ${to})`
		: sql``;
	const incomeFromClause = from ? sql`and ${transactions.date} >= ${from}` : sql``;
	const incomeToClause = to ? sql`and ${transactions.date} <= ${to}` : sql``;

	const rows = await db
		.select({
			accountId: accounts.id,
			parentId: accounts.parentId,
			name: accounts.name,
			type: accounts.type,
			currency: accounts.currency,
			hidden: accounts.hiddenFromDashboard,
			balance: sql<string>`coalesce(sum(
        case
          when ${accounts.type} in ('ASSET', 'LIABILITY') ${assetLiabDateClause}
            then ${transactionEntries.baseAmount}
          when ${accounts.type} in ('INCOME', 'EXPENSE') ${incomeFromClause} ${incomeToClause}
            then ${transactionEntries.baseAmount}
          else null
        end
      ), 0)`,
			nativeBalance: sql<string>`coalesce(sum(
        case
          when ${accounts.type} in ('ASSET', 'LIABILITY') ${assetLiabDateClause}
            then case when ${transactionEntries.currency} = ${accounts.currency} then ${transactionEntries.amount} else null end
          when ${accounts.type} in ('INCOME', 'EXPENSE') ${incomeFromClause} ${incomeToClause}
            then case when ${transactionEntries.currency} = ${accounts.currency} then ${transactionEntries.amount} else null end
          else null
        end
      ), 0)`,
		})
		.from(accounts)
		.leftJoin(transactionEntries, eq(transactionEntries.accountId, accounts.id))
		.leftJoin(transactions, and(eq(transactions.id, transactionEntries.transactionId)))
		.where(and(eq(accounts.workspaceId, workspaceId), isNull(accounts.archivedAt)))
		.groupBy(
			accounts.id,
			accounts.parentId,
			accounts.name,
			accounts.type,
			accounts.currency,
			accounts.hiddenFromDashboard,
		);

	// Roll up children's baseAmount into parent balance
	const mutable = rows.map((r) => ({
		...r,
		balance: Number(r.balance),
		nativeBalance: Number(r.nativeBalance),
	}));
	const byId = new Map(mutable.map((r) => [r.accountId, r]));
	for (const row of mutable) {
		if (!row.parentId || row.hidden) continue;
		const parent = byId.get(row.parentId);
		if (!parent || parent.type !== row.type) continue;
		parent.balance += row.balance;
		if (row.currency === parent.currency) {
			parent.nativeBalance += row.nativeBalance;
		}
	}

	return mutable.map((r) => ({
		...r,
		balance: String(r.balance),
		nativeBalance: String(r.nativeBalance),
	}));
}
