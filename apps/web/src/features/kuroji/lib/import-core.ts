// Provider-agnostic import primitives shared by the Enable Banking sync
// (bank-sync.ts) and the Privat24 statement importer (privat24-import.ts).
// No auth here — callers must authorize first.

import { accounts, and, db, eq, transactionEntries, transactions } from "@seikatsu/db";
import { getExchangeRate } from "./exchange-rates";

export function isoDate(d: Date): string {
	return d.toISOString().slice(0, 10);
}

export function dayBefore(isoDateStr: string): string {
	const d = new Date(`${isoDateStr}T00:00:00Z`);
	d.setUTCDate(d.getUTCDate() - 1);
	return d.toISOString().slice(0, 10);
}

// First keyword rule whose matchText appears in the description, or null.
export function matchRule(
	description: string,
	rules: { matchText: string; accountId: string }[],
): string | null {
	const haystack = description.toLowerCase();
	return rules.find((r) => haystack.includes(r.matchText.toLowerCase()))?.accountId ?? null;
}

// Resolve the counterpart (category) account for one imported transaction.
// outflow → expense side; inflow → income side. A keyword rule wins if its
// matchText is contained in the description.
export function resolveCounterpart(
	description: string,
	isInflow: boolean,
	rules: { matchText: string; accountId: string }[],
	uncategorized: { incomeId: string; expenseId: string },
): string {
	return (
		matchRule(description, rules) ?? (isInflow ? uncategorized.incomeId : uncategorized.expenseId)
	);
}

// Find-or-create the two fallback category accounts for a workspace.
export async function ensureUncategorized(
	workspaceId: string,
	baseCurrency: string,
): Promise<{ incomeId: string; expenseId: string }> {
	const existing = await db
		.select({ id: accounts.id, name: accounts.name, type: accounts.type })
		.from(accounts)
		.where(eq(accounts.workspaceId, workspaceId));

	const findOrMake = async (name: string, type: "INCOME" | "EXPENSE") => {
		const hit = existing.find((a) => a.name === name && a.type === type);
		if (hit) return hit.id;
		const [created] = await db
			.insert(accounts)
			.values({ workspaceId, name, type, currency: baseCurrency })
			.returning({ id: accounts.id });
		return created.id;
	};

	const [incomeId, expenseId] = await Promise.all([
		findOrMake("Uncategorized Income", "INCOME"),
		findOrMake("Uncategorized Expenses", "EXPENSE"),
	]);
	return { incomeId, expenseId };
}

// Find-or-create the "Opening Balance" counterpart account. Mirrors the Kuroji
// convention: a LIABILITY account excluded from liability/net-worth rollups,
// used to seed an asset's starting balance via double-entry.
export async function ensureOpeningBalanceAccount(
	workspaceId: string,
	baseCurrency: string,
): Promise<string> {
	const [existing] = await db
		.select({ id: accounts.id })
		.from(accounts)
		.where(and(eq(accounts.workspaceId, workspaceId), eq(accounts.name, "Opening Balance")))
		.limit(1);
	if (existing) return existing.id;
	const [created] = await db
		.insert(accounts)
		.values({ workspaceId, name: "Opening Balance", type: "LIABILITY", currency: baseCurrency })
		.returning({ id: accounts.id });
	return created.id;
}

// Insert one imported transaction as a balanced double-entry, deduped by
// (workspaceId, externalId). Returns true if a new row was created.
export async function insertImported(opts: {
	workspaceId: string;
	externalId: string;
	date: string;
	description: string;
	bankAccountId: string;
	counterpartId: string;
	isInflow: boolean;
	amount: number;
	currency: string;
	baseCurrency: string;
}): Promise<boolean> {
	const {
		workspaceId,
		externalId,
		date,
		description,
		bankAccountId,
		counterpartId,
		isInflow,
		amount,
		currency,
		baseCurrency,
	} = opts;

	const rate = currency === baseCurrency ? 1 : await getExchangeRate(currency, baseCurrency, date);
	const baseAmount = amount * rate;

	// inflow: counterpart(income) → bank asset ; outflow: bank asset → counterpart(expense)
	const fromAccountId = isInflow ? counterpartId : bankAccountId;
	const toAccountId = isInflow ? bankAccountId : counterpartId;

	return db.transaction(async (tx) => {
		const [txn] = await tx
			.insert(transactions)
			.values({ workspaceId, date, description, externalId })
			.onConflictDoNothing({ target: [transactions.workspaceId, transactions.externalId] })
			.returning({ id: transactions.id });

		if (!txn) return false; // already imported

		await tx.insert(transactionEntries).values([
			{
				transactionId: txn.id,
				accountId: fromAccountId,
				amount: String(-amount),
				currency,
				baseAmount: (-baseAmount).toFixed(4),
			},
			{
				transactionId: txn.id,
				accountId: toAccountId,
				amount: String(amount),
				currency,
				baseAmount: baseAmount.toFixed(4),
			},
		]);
		return true;
	});
}

// Seed a starting balance for `kurojiAccountId` as of `openingDate`, using the
// Opening Balance counterpart. Idempotent via the caller-supplied externalId.
export async function postOpeningBalance(opts: {
	workspaceId: string;
	kurojiAccountId: string;
	externalId: string;
	opening: number; // signed, in `currency`
	openingDate: string;
	currency: string;
	baseCurrency: string;
}): Promise<void> {
	const { workspaceId, kurojiAccountId, externalId, opening, openingDate, currency, baseCurrency } =
		opts;
	// Nothing meaningful to seed.
	if (Math.abs(opening) < 0.005) return;

	const openingAccountId = await ensureOpeningBalanceAccount(workspaceId, baseCurrency);
	const amount = Math.abs(opening);
	const rate =
		currency === baseCurrency ? 1 : await getExchangeRate(currency, baseCurrency, openingDate);
	const baseAmount = amount * rate;

	// opening > 0 → account increases from Opening Balance (from=OB, to=account).
	const fromAccountId = opening > 0 ? openingAccountId : kurojiAccountId;
	const toAccountId = opening > 0 ? kurojiAccountId : openingAccountId;

	await db.transaction(async (tx) => {
		const [txn] = await tx
			.insert(transactions)
			.values({ workspaceId, date: openingDate, description: "Opening balance", externalId })
			.onConflictDoNothing({ target: [transactions.workspaceId, transactions.externalId] })
			.returning({ id: transactions.id });
		if (!txn) return; // already seeded

		await tx.insert(transactionEntries).values([
			{
				transactionId: txn.id,
				accountId: fromAccountId,
				amount: String(-amount),
				currency,
				baseAmount: (-baseAmount).toFixed(4),
			},
			{
				transactionId: txn.id,
				accountId: toAccountId,
				amount: String(amount),
				currency,
				baseAmount: baseAmount.toFixed(4),
			},
		]);
	});
}
