"use server";

import { auth } from "@/auth";
import { getExchangeRate } from "@/features/kuroji/lib/exchange-rates";
import {
	accounts,
	and,
	asc,
	count,
	db,
	desc,
	eq,
	gte,
	ilike,
	inArray,
	lte,
	sql,
	tags,
	transactionEntries,
	transactionTags,
	transactions,
	workspaces,
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
	baseAmount: string;
	splitCount: number;
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

export async function createTransaction({
	workspaceId,
	fromAccountId,
	toAccountId,
	amount,
	toSplits,
	fromSplits,
	currency,
	description,
	date,
	tagIds,
}: {
	workspaceId: string;
	fromAccountId?: string;
	toAccountId?: string;
	amount?: number;
	toSplits?: { accountId: string; amount: number }[];
	fromSplits?: { accountId: string; amount: number }[];
	currency: string;
	description?: string;
	date: string;
	tagIds?: string[];
}): Promise<{ error: string } | { success: true }> {
	try {
		const session = await auth();
		if (!session?.user?.id) return { error: "Unauthorized" };

		const specs = buildEntrySpecs(fromAccountId, toAccountId, amount, toSplits, fromSplits);
		if (!specs) return { error: "Invalid transaction params" };

		const [ws] = await db.select().from(workspaces).where(eq(workspaces.id, workspaceId)).limit(1);
		if (!ws) return { error: "Workspace not found" };
		if (ws.userId !== session.user.id) return { error: "Forbidden" };

		const allAccountIds = [...new Set(specs.map((s) => s.accountId))];
		const validAccts = await db
			.select({ id: accounts.id })
			.from(accounts)
			.where(and(inArray(accounts.id, allAccountIds), eq(accounts.workspaceId, workspaceId)));
		if (validAccts.length !== allAccountIds.length) return { error: "Account not found" };

		const baseCurrency = ws.baseCurrency;
		const rate =
			currency === baseCurrency ? 1 : await getExchangeRate(currency, baseCurrency, date);

		await db.transaction(async (tx) => {
			const [txn] = await tx
				.insert(transactions)
				.values({ workspaceId, date, description: description ?? null })
				.returning();

			const totalDebitBase = specs
				.filter((s) => s.debit)
				.reduce((sum, s) => sum + s.amount * rate, 0);
			const creditSpecs = specs.filter((s) => !s.debit);
			let creditBaseAccum = 0;

			await tx.insert(transactionEntries).values(
				specs.map((spec) => {
					let baseAmount: string;
					if (spec.debit) {
						baseAmount = (-spec.amount * rate).toFixed(4);
					} else {
						const isLastCredit = spec === creditSpecs[creditSpecs.length - 1];
						if (isLastCredit) {
							baseAmount = (totalDebitBase - creditBaseAccum).toFixed(4);
						} else {
							const ba = spec.amount * rate;
							creditBaseAccum += ba;
							baseAmount = ba.toFixed(4);
						}
					}
					return {
						transactionId: txn.id,
						accountId: spec.accountId,
						amount: spec.debit ? String(-spec.amount) : String(spec.amount),
						currency,
						baseAmount,
					};
				}),
			);

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

	const [ws] = await db
		.select({ userId: workspaces.userId })
		.from(workspaces)
		.where(eq(workspaces.id, txn.workspaceId))
		.limit(1);

	if (!ws || ws.userId !== session.user.id) return { error: "Forbidden" };

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

	const [ws] = await db
		.select({ userId: workspaces.userId })
		.from(workspaces)
		.where(eq(workspaces.id, workspaceId))
		.limit(1);

	if (!ws || ws.userId !== session.user.id) return { error: "Forbidden" };

	const deleted = await db
		.delete(transactions)
		.where(and(inArray(transactions.id, ids), eq(transactions.workspaceId, workspaceId)))
		.returning({ id: transactions.id });

	revalidatePath("/kuroji");
	return { success: true, deleted: deleted.length };
}

export async function updateTransaction({
	transactionId,
	fromAccountId,
	toAccountId,
	amount,
	currency,
	description,
	date,
	tagIds,
}: {
	transactionId: string;
	fromAccountId: string;
	toAccountId: string;
	amount: number;
	currency: string;
	description: string | undefined;
	date: string;
	tagIds?: string[];
}): Promise<{ error: string } | { success: true }> {
	const session = await auth();
	if (!session?.user?.id) return { error: "Unauthorized" };

	const [txnRow] = await db
		.select({ workspaceId: transactions.workspaceId })
		.from(transactions)
		.where(eq(transactions.id, transactionId))
		.limit(1);

	if (!txnRow) return { error: "Transaction not found" };

	const [wsRows, fromRows, toRows] = await Promise.all([
		db.select().from(workspaces).where(eq(workspaces.id, txnRow.workspaceId)).limit(1),
		db
			.select()
			.from(accounts)
			.where(and(eq(accounts.id, fromAccountId), eq(accounts.workspaceId, txnRow.workspaceId)))
			.limit(1),
		db
			.select()
			.from(accounts)
			.where(and(eq(accounts.id, toAccountId), eq(accounts.workspaceId, txnRow.workspaceId)))
			.limit(1),
	]);

	const workspace = wsRows[0];
	if (!workspace || workspace.userId !== session.user.id) return { error: "Forbidden" };
	if (!fromRows[0] || !toRows[0]) return { error: "Account not found" };

	const baseCurrency = workspace.baseCurrency;
	let baseAmount: number;
	if (currency === baseCurrency) {
		baseAmount = amount;
	} else {
		const rate = await getExchangeRate(currency, baseCurrency, date);
		baseAmount = amount * rate;
	}

	await db.transaction(async (tx) => {
		await tx
			.update(transactions)
			.set({ date, description: description ?? null })
			.where(eq(transactions.id, transactionId));
		await tx.delete(transactionEntries).where(eq(transactionEntries.transactionId, transactionId));
		await tx.insert(transactionEntries).values([
			{
				transactionId,
				accountId: fromAccountId,
				amount: String(-amount),
				currency,
				baseAmount: (-baseAmount).toFixed(4),
			},
			{
				transactionId,
				accountId: toAccountId,
				amount: String(amount),
				currency,
				baseAmount: baseAmount.toFixed(4),
			},
		]);
		if (tagIds !== undefined) {
			await tx.delete(transactionTags).where(eq(transactionTags.transactionId, transactionId));
			if (tagIds.length > 0) {
				await assertTagsInWorkspace(tx, tagIds, workspace.id);
				await tx.insert(transactionTags).values(tagIds.map((tagId) => ({ transactionId, tagId })));
			}
		}
	});

	revalidatePath("/kuroji");
	return { success: true };
}

const TRANSACTIONS_PAGE_SIZE = 10;

export type SortField = "date" | "amount";
export type SortDir = "asc" | "desc";

export async function getRecentTransactions(
	workspaceId: string,
	from: string | undefined,
	to: string | undefined,
	page = 0,
	accountId?: string,
	q?: string,
	sortField: SortField = "date",
	sortDir: SortDir = "desc",
	tagId?: string,
): Promise<{ rows: RecentTransaction[]; hasMore: boolean; total: number }> {
	const session = await auth();
	if (!session?.user?.id) throw new Error("Unauthorized");

	const [ws] = await db
		.select({ userId: workspaces.userId })
		.from(workspaces)
		.where(eq(workspaces.id, workspaceId))
		.limit(1);

	if (!ws || ws.userId !== session.user.id) throw new Error("Forbidden");

	const accountSubquery = accountId
		? db
				.selectDistinct({ id: transactionEntries.transactionId })
				.from(transactionEntries)
				.where(eq(transactionEntries.accountId, accountId))
		: undefined;

	const tagSubquery = tagId
		? db
				.selectDistinct({ id: transactionTags.transactionId })
				.from(transactionTags)
				.where(eq(transactionTags.tagId, tagId))
		: undefined;

	const whereClause = and(
		eq(transactions.workspaceId, workspaceId),
		from ? gte(transactions.date, from) : undefined,
		to ? lte(transactions.date, to) : undefined,
		q ? ilike(transactions.description, `%${q}%`) : undefined,
		accountSubquery ? inArray(transactions.id, accountSubquery) : undefined,
		tagSubquery ? inArray(transactions.id, tagSubquery) : undefined,
	);

	const orderDate = sortDir === "asc" ? asc(transactions.date) : desc(transactions.date);
	const orderCreated =
		sortDir === "asc" ? asc(transactions.createdAt) : desc(transactions.createdAt);
	const amountExpr = sql`(select coalesce(sum(abs(te.base_amount)), 0) from transaction_entries te where te.transaction_id = ${transactions.id} and cast(te.base_amount as numeric) > 0)`;
	const orderAmount = sortDir === "asc" ? asc(amountExpr) : desc(amountExpr);

	const [rows, [{ total }]] = await Promise.all([
		db.query.transactions.findMany({
			where: whereClause,
			orderBy: sortField === "date" ? [orderDate, orderCreated] : [orderAmount, orderDate],
			limit: TRANSACTIONS_PAGE_SIZE + 1,
			offset: page * TRANSACTIONS_PAGE_SIZE,
			with: { entries: { with: { account: true } }, transactionTags: { with: { tag: true } } },
		}),
		db.select({ total: count() }).from(transactions).where(whereClause),
	]);

	const hasMore = rows.length > TRANSACTIONS_PAGE_SIZE;
	const page_rows = hasMore ? rows.slice(0, TRANSACTIONS_PAGE_SIZE) : rows;

	return {
		hasMore,
		total,
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
				baseAmount: totalBaseAmount.toFixed(4),
				splitCount: toEntries.length,
				tags: txn.transactionTags.map((tt) => ({
					id: tt.tag.id,
					name: tt.tag.name,
					color: tt.tag.color,
				})),
			};
		}),
	};
}
