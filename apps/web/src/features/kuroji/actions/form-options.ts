"use server";

import { getAccounts } from "@/features/kuroji/actions/accounts";
import { type Tag, getTags } from "@/features/kuroji/actions/tags";
import { type CategoryUsage, pickUsage } from "@/features/kuroji/lib/category-tiles";
import { getOwnedWorkspace } from "@/lib/session";
import {
	accounts,
	and,
	count,
	db,
	eq,
	gte,
	inArray,
	transactionEntries,
	transactions,
} from "@seikatsu/db";

export type FormAccount = Awaited<ReturnType<typeof getAccounts>>[number];
export type FormOptions = { accounts: FormAccount[]; tags: Tag[]; categoryUsage: CategoryUsage };

const RECENT_DAYS = 180;

/** Accounts, tags and category usage for the Kuroji forms in one round trip (server actions run serially). */
export async function getFormOptions(workspaceId: string): Promise<FormOptions> {
	const [accounts, tags, categoryUsage] = await Promise.all([
		getAccounts(workspaceId),
		getTags(workspaceId),
		getCategoryUsage(workspaceId),
	]);
	return { accounts, tags, categoryUsage };
}

/** How often each income/expense category was used, so the capture form can offer the usual ones. */
async function getCategoryUsage(workspaceId: string): Promise<CategoryUsage> {
	if (!(await getOwnedWorkspace(workspaceId))) throw new Error("Forbidden");
	const since = new Date(Date.now() - RECENT_DAYS * 86_400_000).toISOString().slice(0, 10);
	const [recent, allTime] = await Promise.all([
		countCategoryEntries(workspaceId, since),
		countCategoryEntries(workspaceId),
	]);
	return pickUsage(recent, allTime);
}

async function countCategoryEntries(workspaceId: string, since?: string): Promise<CategoryUsage> {
	const rows = await db
		.select({ accountId: transactionEntries.accountId, entries: count() })
		.from(transactionEntries)
		.innerJoin(transactions, eq(transactions.id, transactionEntries.transactionId))
		.innerJoin(accounts, eq(accounts.id, transactionEntries.accountId))
		.where(
			and(
				eq(transactions.workspaceId, workspaceId),
				inArray(accounts.type, ["INCOME", "EXPENSE"]),
				since ? gte(transactions.date, since) : undefined,
			),
		)
		.groupBy(transactionEntries.accountId);
	return Object.fromEntries(rows.map((r) => [r.accountId, r.entries]));
}
