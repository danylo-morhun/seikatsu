// Read-side queries for Kuroji. Not a "use server" module, so nothing here is
// callable from the client — import only from RSC pages, route handlers or server actions.

import {
	accounts,
	and,
	asc,
	bankConnections,
	bankRules,
	count,
	db,
	desc,
	eq,
	isNull,
	recurringTransactions,
	tags,
	transactions,
} from "@seikatsu/db";
import { cache } from "react";
import type { RecurringTransaction } from "@/features/kuroji/actions/recurring";
import type { Tag } from "@/features/kuroji/actions/tags";
import type { RecentTransaction } from "@/features/kuroji/actions/transactions";
import { type BankProblem, worstBankProblem } from "@/features/kuroji/lib/bank-health";
import type { Frequency } from "@/features/kuroji/lib/recurring-runner";
import {
	clampPage,
	TRANSACTIONS_PAGE_SIZE,
	type TransactionFilters,
} from "@/features/kuroji/lib/transaction-filters";
import { transactionOrder, transactionWhere } from "@/features/kuroji/lib/transaction-query";
import { getCurrentWorkspace, getOwnedWorkspace, getSessionUserId } from "@/lib/session";
import { getUserTimeZone } from "@/lib/timezone";

/** Throws unless the signed-in user owns the workspace (signed out → not owned). */
async function assertOwned(workspaceId: string) {
	if (!(await getOwnedWorkspace(workspaceId))) throw new Error("Forbidden");
}

export async function getWorkspace(userId: string) {
	if ((await getSessionUserId()) !== userId) throw new Error("Unauthorized");
	return getCurrentWorkspace();
}

export async function initializeWorkspace(userId: string) {
	const workspace = await getWorkspace(userId);
	if (!workspace) throw new Error("Unauthorized");
	return workspace;
}

export async function getAccounts(workspaceId: string, opts?: { includeArchived?: boolean }) {
	await assertOwned(workspaceId);

	const filter = opts?.includeArchived
		? eq(accounts.workspaceId, workspaceId)
		: and(eq(accounts.workspaceId, workspaceId), isNull(accounts.archivedAt));
	return db.select().from(accounts).where(filter);
}

export async function getTags(workspaceId: string): Promise<Tag[]> {
	await assertOwned(workspaceId);

	return db
		.select({ id: tags.id, name: tags.name, color: tags.color })
		.from(tags)
		.where(eq(tags.workspaceId, workspaceId));
}

export async function getRecurringTransactions(
	workspaceId: string,
): Promise<RecurringTransaction[]> {
	await assertOwned(workspaceId);

	const rows = await db.query.recurringTransactions.findMany({
		where: eq(recurringTransactions.workspaceId, workspaceId),
		with: {
			fromAccount: true,
			toAccount: true,
		},
		orderBy: (rt, { desc }) => [desc(rt.createdAt)],
	});

	return rows.map((r) => ({
		id: r.id,
		fromAccountId: r.fromAccountId,
		fromAccountName: r.fromAccount?.name ?? "—",
		toAccountId: r.toAccountId,
		toAccountName: r.toAccount?.name ?? "—",
		amount: r.amount,
		currency: r.currency,
		description: r.description,
		frequency: r.frequency as Frequency,
		nextDate: r.nextDate,
		endDate: r.endDate,
		isActive: r.isActive,
	}));
}

export async function getRecentTransactions(
	workspaceId: string,
	filters: TransactionFilters,
	page = 0,
): Promise<{ rows: RecentTransaction[]; hasMore: boolean; total: number; page: number }> {
	await assertOwned(workspaceId);

	const where = transactionWhere(workspaceId, filters);
	const fetchPage = (p: number) =>
		db.query.transactions.findMany({
			where,
			orderBy: transactionOrder(filters),
			limit: TRANSACTIONS_PAGE_SIZE + 1,
			offset: p * TRANSACTIONS_PAGE_SIZE,
			with: {
				entries: { with: { account: { columns: { name: true, type: true } } } },
				transactionTags: { with: { tag: { columns: { id: true, name: true, color: true } } } },
			},
		});
	const [firstTry, [{ total }]] = await Promise.all([
		fetchPage(page),
		db.select({ total: count() }).from(transactions).where(where),
	]);
	// A page past the end (an old link, rows deleted since) shows the last page.
	const shownPage = clampPage(page, total);
	const rows = shownPage === page ? firstTry : await fetchPage(shownPage);

	const hasMore = rows.length > TRANSACTIONS_PAGE_SIZE;
	const page_rows = hasMore ? rows.slice(0, TRANSACTIONS_PAGE_SIZE) : rows;

	return {
		hasMore,
		total,
		page: shownPage,
		rows: page_rows.map((txn) => {
			const fromEntries = txn.entries.filter((e) => Number(e.baseAmount) < 0);
			const toEntries = txn.entries.filter((e) => Number(e.baseAmount) > 0);
			const fromEntry = fromEntries[0];
			const toEntry = toEntries[0];
			const toIsSplit = toEntries.length > 1;
			const fromIsSplit = fromEntries.length > 1;
			const totalAmount = toIsSplit
				? toEntries.reduce((sum, e) => sum + Math.abs(Number(e.amount)), 0)
				: Math.abs(Number(toEntry?.amount ?? 0));
			const totalBaseAmount = toIsSplit
				? toEntries.reduce((sum, e) => sum + Number(e.baseAmount), 0)
				: Number(toEntry?.baseAmount ?? 0);
			return {
				id: txn.id,
				date: txn.date,
				description: txn.description,
				imported: txn.externalId !== null,
				fromAccount: fromIsSplit
					? `Split (${fromEntries.length})`
					: (fromEntry?.account?.name ?? "—"),
				fromAccountId: fromEntry?.accountId ?? "",
				fromAccountType: fromEntry?.account?.type ?? "",
				toAccount: toIsSplit ? `Split (${toEntries.length})` : (toEntry?.account?.name ?? "—"),
				toAccountId: toEntry?.accountId ?? "",
				toAccountType: toEntry?.account?.type ?? "",
				amount: totalAmount.toFixed(2),
				currency: toEntry?.currency ?? "",
				fromAmount: Math.abs(Number(fromEntry?.amount ?? 0)).toFixed(2),
				fromCurrency: fromEntry?.currency ?? "",
				baseAmount: totalBaseAmount.toFixed(4),
				splitCount: toEntries.length,
				legs: txn.entries.map((e) => ({
					accountId: e.accountId,
					accountType: e.account?.type ?? "",
					amount: e.amount,
					currency: e.currency,
					baseAmount: e.baseAmount,
				})),
				tags: txn.transactionTags.map((tt) => ({
					id: tt.tag.id,
					name: tt.tag.name,
					color: tt.tag.color,
				})),
			};
		}),
	};
}

export async function hasAnyTransactions(workspaceId: string): Promise<boolean> {
	await assertOwned(workspaceId);
	const [row] = await db
		.select({ id: transactions.id })
		.from(transactions)
		.where(eq(transactions.workspaceId, workspaceId))
		.limit(1);
	return !!row;
}

export async function getBankConnections(workspaceId: string) {
	await assertOwned(workspaceId);
	return db.query.bankConnections.findMany({
		where: eq(bankConnections.workspaceId, workspaceId),
		orderBy: [desc(bankConnections.createdAt)],
		// Only what the settings list shows: auth state and session ids stay on the server.
		columns: { id: true, displayName: true, status: true, lastSyncedAt: true, lastError: true },
		with: {
			bankAccounts: {
				columns: { id: true, accountUid: true, name: true, iban: true, accountId: true },
			},
		},
	});
}

// Request-scoped: any part of a page can ask again without another query.
const loadConnectionStates = cache((workspaceId: string) =>
	db.query.bankConnections.findMany({
		where: eq(bankConnections.workspaceId, workspaceId),
		columns: {
			displayName: true,
			status: true,
			accessExpiresAt: true,
			lastSyncedAt: true,
			createdAt: true,
		},
	}),
);

/** The bank connection that stopped feeding the ledger, if any. */
export async function getBankProblem(workspaceId: string): Promise<BankProblem | null> {
	await assertOwned(workspaceId);
	const [connections, timeZone] = await Promise.all([
		loadConnectionStates(workspaceId),
		getUserTimeZone(),
	]);
	return worstBankProblem(connections, new Date(), timeZone);
}

export async function getBankRules(workspaceId: string) {
	await assertOwned(workspaceId);
	return db
		.select({
			id: bankRules.id,
			matchText: bankRules.matchText,
			accountId: bankRules.accountId,
			priority: bankRules.priority,
		})
		.from(bankRules)
		.where(eq(bankRules.workspaceId, workspaceId))
		.orderBy(asc(bankRules.priority), asc(bankRules.createdAt));
}
