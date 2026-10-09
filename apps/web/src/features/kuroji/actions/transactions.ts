"use server";

import { auth } from "@/auth";
import { getExchangeRate } from "@/features/kuroji/lib/exchange-rates";
import type { Leg } from "@/features/kuroji/lib/transaction-edit";
import {
	TRANSACTIONS_PAGE_SIZE,
	type TransactionFilters,
	clampPage,
} from "@/features/kuroji/lib/transaction-filters";
import { transactionOrder, transactionWhere } from "@/features/kuroji/lib/transaction-query";
import { getOwnedWorkspace } from "@/lib/session";
import {
	accounts,
	and,
	count,
	db,
	eq,
	inArray,
	tags,
	transactionEntries,
	transactionTags,
	transactions,
} from "@seikatsu/db";
import { revalidatePath } from "next/cache";

export type RecentTransaction = {
	id: string;
	date: string;
	description: string | null;
	fromAccount: string;
	fromAccountId: string;
	fromAccountType: string;
	toAccount: string;
	toAccountId: string;
	toAccountType: string;
	amount: string;
	currency: string;
	fromAmount: string;
	fromCurrency: string;
	baseAmount: string;
	splitCount: number;
	/** Every stored entry, so the edit form can load splits whole. */
	legs: Leg[];
	tags: { id: string; name: string; color: string | null }[];
};

type EntrySpec = { accountId: string; debit: boolean; amount: number };

async function assertTagsInWorkspace(
	tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
	tagIds: string[],
	workspaceId: string,
) {
	if (tagIds.length === 0) return;
	const valid = await tx
		.select({ id: tags.id })
		.from(tags)
		.where(and(inArray(tags.id, tagIds), eq(tags.workspaceId, workspaceId)));
	if (valid.length !== tagIds.length) throw new Error("Tag not found");
}

function buildEntrySpecs(
	fromAccountId?: string,
	toAccountId?: string,
	amount?: number,
	toSplits?: { accountId: string; amount: number }[],
	fromSplits?: { accountId: string; amount: number }[],
): EntrySpec[] | null {
	if (toSplits && toSplits.length > 0 && fromAccountId) {
		const total = toSplits.reduce((s, e) => s + e.amount, 0);
		return [
			{ accountId: fromAccountId, debit: true, amount: total },
			...toSplits.map((s) => ({ accountId: s.accountId, debit: false, amount: s.amount })),
		];
	}
	if (fromSplits && fromSplits.length > 0 && toAccountId) {
		const total = fromSplits.reduce((s, e) => s + e.amount, 0);
		return [
			...fromSplits.map((s) => ({ accountId: s.accountId, debit: true, amount: s.amount })),
			{ accountId: toAccountId, debit: false, amount: total },
		];
	}
	if (fromAccountId && toAccountId && amount !== undefined) {
		return [
			{ accountId: fromAccountId, debit: true, amount },
			{ accountId: toAccountId, debit: false, amount },
		];
	}
	return null;
}

type EntryRow = { accountId: string; amount: string; currency: string; baseAmount: string };

/**
 * Each entry is stored in its own account's currency. `amount` on a spec is in the entered
 * `currency`; legs in another currency use `received` (2-leg only) or the day's rate.
 * Base amounts sum to zero: 2-leg transactions take the base value from the leg already in
 * the base currency (the real exchange), splits put the rounding remainder on the last credit.
 */
async function buildEntries(
	specs: EntrySpec[],
	currency: string,
	date: string,
	baseCurrency: string,
	accountCurrency: Map<string, string>,
	received?: number,
): Promise<EntryRow[]> {
	const rates = new Map<string, number>();
	const rate = async (to: string) => {
		if (to === currency) return 1;
		let r = rates.get(to);
		if (r === undefined) {
			r = await getExchangeRate(currency, to, date);
			rates.set(to, r);
		}
		return r;
	};

	const natives = await Promise.all(
		specs.map(async (spec) => {
			const cur = accountCurrency.get(spec.accountId) ?? currency;
			if (cur === currency) return { cur, amount: spec.amount };
			if (received !== undefined && specs.length === 2 && !spec.debit) {
				return { cur, amount: received };
			}
			return { cur, amount: spec.amount * (await rate(cur)) };
		}),
	);

	let bases: number[];
	if (specs.length === 2) {
		const baseLeg = natives.find((n) => n.cur === baseCurrency);
		const total = baseLeg ? baseLeg.amount : specs[0].amount * (await rate(baseCurrency));
		bases = specs.map((s) => (s.debit ? -total : total));
	} else {
		const r = await rate(baseCurrency);
		const totalDebit = specs.filter((s) => s.debit).reduce((sum, s) => sum + s.amount * r, 0);
		const lastCredit = specs.findLastIndex((s) => !s.debit);
		let creditAccum = 0;
		bases = specs.map((s, i) => {
			if (s.debit) return -s.amount * r;
			if (i === lastCredit) return totalDebit - creditAccum;
			creditAccum += s.amount * r;
			return s.amount * r;
		});
	}

	return specs.map((spec, i) => ({
		accountId: spec.accountId,
		amount: (spec.debit ? -natives[i].amount : natives[i].amount).toFixed(4),
		currency: natives[i].cur,
		baseAmount: bases[i].toFixed(4),
	}));
}

type TransactionInput = {
	fromAccountId?: string;
	toAccountId?: string;
	amount?: number;
	toSplits?: { accountId: string; amount: number }[];
	fromSplits?: { accountId: string; amount: number }[];
	currency: string;
	/** Amount that landed in the destination account, in its currency (cross-currency transfers). */
	received?: number;
	description?: string;
	date: string;
	tagIds?: string[];
};

/** Entry rows for a create or edit: one wallet leg against one or more category legs. */
async function prepareEntries(
	workspace: { id: string; baseCurrency: string },
	input: TransactionInput,
): Promise<{ error: string } | { entries: EntryRow[] }> {
	const { fromAccountId, toAccountId, amount, toSplits, fromSplits } = input;
	const specs = buildEntrySpecs(fromAccountId, toAccountId, amount, toSplits, fromSplits);
	if (!specs) return { error: "Invalid transaction params" };

	const allAccountIds = [...new Set(specs.map((s) => s.accountId))];
	const validAccts = await db
		.select({ id: accounts.id, currency: accounts.currency })
		.from(accounts)
		.where(and(inArray(accounts.id, allAccountIds), eq(accounts.workspaceId, workspace.id)));
	if (validAccts.length !== allAccountIds.length) return { error: "Account not found" };

	const entries = await buildEntries(
		specs,
		input.currency,
		input.date,
		workspace.baseCurrency,
		new Map(validAccts.map((a) => [a.id, a.currency])),
		input.received,
	);
	return { entries };
}

export async function createTransaction({
	workspaceId,
	...input
}: TransactionInput & { workspaceId: string }): Promise<{ error: string } | { success: true }> {
	try {
		const session = await auth();
		if (!session?.user?.id) return { error: "Unauthorized" };

		const ws = await getOwnedWorkspace(workspaceId);
		if (!ws) return { error: "Forbidden" };

		const prepared = await prepareEntries(ws, input);
		if ("error" in prepared) return prepared;
		const { description, date, tagIds } = input;

		await db.transaction(async (tx) => {
			const [txn] = await tx
				.insert(transactions)
				.values({ workspaceId, date, description: description ?? null })
				.returning();

			await tx
				.insert(transactionEntries)
				.values(prepared.entries.map((e) => ({ ...e, transactionId: txn.id })));

			if (tagIds && tagIds.length > 0) {
				await assertTagsInWorkspace(tx, tagIds, workspaceId);
				await tx
					.insert(transactionTags)
					.values(tagIds.map((tagId) => ({ transactionId: txn.id, tagId })));
			}
		});

		revalidatePath("/kuroji");
		return { success: true };
	} catch (e) {
		const msg = e instanceof Error ? e.message : "Unknown error";
		return { error: msg };
	}
}

export async function deleteTransaction(
	transactionId: string,
): Promise<{ error: string } | { success: true }> {
	const session = await auth();
	if (!session?.user?.id) return { error: "Unauthorized" };

	const [txn] = await db
		.select({ workspaceId: transactions.workspaceId })
		.from(transactions)
		.where(eq(transactions.id, transactionId))
		.limit(1);

	if (!txn) return { error: "Transaction not found" };

	const ws = await getOwnedWorkspace(txn.workspaceId);

	if (!ws) return { error: "Forbidden" };

	await db.delete(transactions).where(eq(transactions.id, transactionId));
	revalidatePath("/kuroji");
	return { success: true };
}

export async function deleteTransactions(
	ids: string[],
	workspaceId: string,
): Promise<{ error: string } | { success: true; deleted: number }> {
	if (ids.length === 0) return { success: true, deleted: 0 };

	const session = await auth();
	if (!session?.user?.id) return { error: "Unauthorized" };

	const ws = await getOwnedWorkspace(workspaceId);

	if (!ws) return { error: "Forbidden" };

	const deleted = await db
		.delete(transactions)
		.where(and(inArray(transactions.id, ids), eq(transactions.workspaceId, workspaceId)))
		.returning({ id: transactions.id });

	revalidatePath("/kuroji");
	return { success: true, deleted: deleted.length };
}

/** Whether the workspace has recorded anything yet — the first-run welcome shows until it has. */
export async function hasAnyTransactions(workspaceId: string): Promise<boolean> {
	const session = await auth();
	if (!session?.user?.id) throw new Error("Unauthorized");
	const ws = await getOwnedWorkspace(workspaceId);
	if (!ws) throw new Error("Forbidden");
	const [row] = await db
		.select({ id: transactions.id })
		.from(transactions)
		.where(eq(transactions.workspaceId, workspaceId))
		.limit(1);
	return !!row;
}

/**
 * Move transactions to another income/expense category. Only the category side changes,
 * so balances and the double-entry sum are untouched. Transactions split across several
 * categories, or whose category entry is in another currency, are skipped and counted.
 */
export async function recategorizeTransactions(
	workspaceId: string,
	transactionIds: string[],
	categoryId: string,
): Promise<{ error: string } | { success: true; data: { moved: number; skipped: number } }> {
	if (transactionIds.length === 0) return { success: true, data: { moved: 0, skipped: 0 } };

	const session = await auth();
	if (!session?.user?.id) return { error: "Unauthorized" };

	const ws = await getOwnedWorkspace(workspaceId);
	if (!ws) return { error: "Forbidden" };

	const [target] = await db
		.select({ id: accounts.id, type: accounts.type, currency: accounts.currency })
		.from(accounts)
		.where(and(eq(accounts.id, categoryId), eq(accounts.workspaceId, workspaceId)))
		.limit(1);
	if (!target || (target.type !== "INCOME" && target.type !== "EXPENSE")) {
		return { error: "Pick an income or expense category" };
	}

	const entries = await db
		.select({
			id: transactionEntries.id,
			transactionId: transactionEntries.transactionId,
			accountId: transactionEntries.accountId,
			currency: transactionEntries.currency,
		})
		.from(transactionEntries)
		.innerJoin(transactions, eq(transactions.id, transactionEntries.transactionId))
		.innerJoin(accounts, eq(accounts.id, transactionEntries.accountId))
		.where(
			and(
				inArray(transactionEntries.transactionId, transactionIds),
				eq(transactions.workspaceId, workspaceId),
				eq(accounts.type, target.type),
			),
		);

	const byTxn = new Map<string, typeof entries>();
	for (const e of entries) byTxn.set(e.transactionId, [...(byTxn.get(e.transactionId) ?? []), e]);

	const movable = [...byTxn.values()]
		.filter((es) => es.length === 1 && es[0].currency === target.currency)
		.map((es) => es[0]);

	if (movable.length > 0) {
		await db
			.update(transactionEntries)
			.set({ accountId: target.id })
			.where(
				inArray(
					transactionEntries.id,
					movable.map((e) => e.id),
				),
			);
		revalidatePath("/kuroji");
	}

	return {
		success: true,
		data: { moved: movable.length, skipped: transactionIds.length - movable.length },
	};
}

/** Rewrites a transaction's entries from the form: every leg, splits included, is rebuilt. */
export async function updateTransaction({
	transactionId,
	...input
}: TransactionInput & { transactionId: string }): Promise<{ error: string } | { success: true }> {
	try {
		const session = await auth();
		if (!session?.user?.id) return { error: "Unauthorized" };

		const [txnRow] = await db
			.select({ workspaceId: transactions.workspaceId })
			.from(transactions)
			.where(eq(transactions.id, transactionId))
			.limit(1);
		if (!txnRow) return { error: "Transaction not found" };

		const ws = await getOwnedWorkspace(txnRow.workspaceId);
		if (!ws) return { error: "Forbidden" };

		const prepared = await prepareEntries(ws, input);
		if ("error" in prepared) return prepared;
		const { description, date, tagIds } = input;

		await db.transaction(async (tx) => {
			await tx
				.update(transactions)
				.set({ date, description: description ?? null })
				.where(eq(transactions.id, transactionId));
			await tx
				.delete(transactionEntries)
				.where(eq(transactionEntries.transactionId, transactionId));
			await tx
				.insert(transactionEntries)
				.values(prepared.entries.map((e) => ({ ...e, transactionId })));
			if (tagIds !== undefined) {
				await tx.delete(transactionTags).where(eq(transactionTags.transactionId, transactionId));
				if (tagIds.length > 0) {
					await assertTagsInWorkspace(tx, tagIds, ws.id);
					await tx
						.insert(transactionTags)
						.values(tagIds.map((tagId) => ({ transactionId, tagId })));
				}
			}
		});

		revalidatePath("/kuroji");
		return { success: true };
	} catch (e) {
		const msg = e instanceof Error ? e.message : "Unknown error";
		return { error: msg };
	}
}

export async function getRecentTransactions(
	workspaceId: string,
	filters: TransactionFilters,
	page = 0,
): Promise<{ rows: RecentTransaction[]; hasMore: boolean; total: number; page: number }> {
	const session = await auth();
	if (!session?.user?.id) throw new Error("Unauthorized");

	const ws = await getOwnedWorkspace(workspaceId);

	if (!ws) throw new Error("Forbidden");

	const where = transactionWhere(workspaceId, filters);
	const fetchPage = (p: number) =>
		db.query.transactions.findMany({
			where,
			orderBy: transactionOrder(filters),
			limit: TRANSACTIONS_PAGE_SIZE + 1,
			offset: p * TRANSACTIONS_PAGE_SIZE,
			with: { entries: { with: { account: true } }, transactionTags: { with: { tag: true } } },
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
