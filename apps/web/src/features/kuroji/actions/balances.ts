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
	name: string;
	type: "ASSET" | "LIABILITY" | "INCOME" | "EXPENSE";
	currency: string;
	balance: string;
	nativeBalance: string;
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
			name: accounts.name,
			type: accounts.type,
			currency: accounts.currency,
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
		.groupBy(accounts.id, accounts.name, accounts.type, accounts.currency);

	return rows;
}
