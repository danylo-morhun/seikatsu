// Core bank-sync logic shared by the server action (user-triggered) and the
// cron route (system-triggered). No auth here — callers must authorize first.

import {
	accounts,
	and,
	asc,
	bankAccounts,
	bankConnections,
	bankRules,
	db,
	eq,
	isNotNull,
	transactionEntries,
	transactions,
	workspaces,
} from "@seikatsu/db";
import {
	type EbTransaction,
	ebTransactionDate,
	ebTransactionDescription,
	ebTransactionExternalId,
	ebTransactionIsInflow,
	getAccountBalance,
	getAccountTransactions,
} from "./enablebanking";
import { getExchangeRate } from "./exchange-rates";

type ConnectionRow = typeof bankConnections.$inferSelect;

export type SyncResult = { imported: number; skipped: number };

// Buffer (days) subtracted from lastSyncedAt so late-posting/amended booked
// transactions are re-fetched. Dedupe by externalId makes the overlap safe.
const SYNC_OVERLAP_DAYS = 3;

function isoDate(d: Date): string {
	return d.toISOString().slice(0, 10);
}

// Resolve the counterpart (category) account for one bank transaction.
// outflow (negative amount) → expense side; inflow (positive) → income side.
// A keyword rule wins if its matchText is contained in the description.
function resolveCounterpart(
	description: string,
	isInflow: boolean,
	rules: { matchText: string; accountId: string }[],
	uncategorized: { incomeId: string; expenseId: string },
): string {
	const haystack = description.toLowerCase();
	const match = rules.find((r) => haystack.includes(r.matchText.toLowerCase()));
	if (match) return match.accountId;
	return isInflow ? uncategorized.incomeId : uncategorized.expenseId;
}

// Find-or-create the two fallback category accounts for a workspace.
async function ensureUncategorized(
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

// Insert one imported transaction as a balanced double-entry, deduped by
// (workspaceId, externalId). Returns true if a new row was created.
async function insertImported(opts: {
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

function dayBefore(isoDateStr: string): string {
	const d = new Date(`${isoDateStr}T00:00:00Z`);
	d.setUTCDate(d.getUTCDate() - 1);
	return d.toISOString().slice(0, 10);
}

// Find-or-create the "Opening Balance" counterpart account. Mirrors the Kuroji
// convention: a LIABILITY account excluded from liability/net-worth rollups,
// used to seed an asset's starting balance via double-entry.
async function ensureOpeningBalanceAccount(
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

// Seed the linked account's starting balance as of the day before the first
// imported transaction. opening = currentBookedBalance − netImportedFlow, so
// once posted the absolute balance reconciles with the bank. Idempotent via a
// fixed externalId; only posts when no opening entry exists yet.
async function ensureOpeningBalance(opts: {
	workspaceId: string;
	accountUid: string;
	kurojiAccountId: string;
	netImported: number; // signed: inflow +, outflow −, in account currency
	openingDate: string;
	baseCurrency: string;
}): Promise<void> {
	const { workspaceId, accountUid, kurojiAccountId, netImported, openingDate, baseCurrency } = opts;
	const externalId = `opening:${accountUid}`;

	const balance = await getAccountBalance(accountUid);
	if (!balance) return;
	// The bank balance's currency is the account's authoritative currency.
	const currency = balance.currency;

	const opening = balance.amount - netImported;
	// Nothing meaningful to seed.
	if (Math.abs(opening) < 0.005) return;

	const openingAccountId = await ensureOpeningBalanceAccount(workspaceId, baseCurrency);
	const amount = Math.abs(opening);
	const rate =
		currency === baseCurrency ? 1 : await getExchangeRate(currency, baseCurrency, openingDate);
	const baseAmount = amount * rate;

	// opening > 0 → asset increases from Opening Balance (from=OB, to=asset).
	const fromAccountId = opening > 0 ? openingAccountId : kurojiAccountId;
	const toAccountId = opening > 0 ? kurojiAccountId : openingAccountId;

	await db.transaction(async (tx) => {
		const [txn] = await tx
			.insert(transactions)
			.values({
				workspaceId,
				date: openingDate,
				description: "Opening balance",
				externalId,
			})
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

function startsExpired(message: string): boolean {
	return /expired|invalid_token|401|access has expired/i.test(message);
}

// Sync a single connection. Mutates connection status/lastSyncedAt/lastError.
export async function syncConnection(connection: ConnectionRow): Promise<SyncResult> {
	const [ws] = await db
		.select({ baseCurrency: workspaces.baseCurrency })
		.from(workspaces)
		.where(eq(workspaces.id, connection.workspaceId))
		.limit(1);
	if (!ws) throw new Error("Workspace not found");
	const baseCurrency = ws.baseCurrency;

	// Only linked bank accounts (mapped to a Kuroji account) are synced.
	const links = await db
		.select({
			accountUid: bankAccounts.accountUid,
			accountId: bankAccounts.accountId,
		})
		.from(bankAccounts)
		.where(and(eq(bankAccounts.connectionId, connection.id), isNotNull(bankAccounts.accountId)));

	if (links.length === 0) return { imported: 0, skipped: 0 };

	const rules = await db
		.select({ matchText: bankRules.matchText, accountId: bankRules.accountId })
		.from(bankRules)
		.where(eq(bankRules.workspaceId, connection.workspaceId))
		.orderBy(asc(bankRules.priority), asc(bankRules.createdAt));

	const uncategorized = await ensureUncategorized(connection.workspaceId, baseCurrency);

	let dateFrom: string | undefined;
	if (connection.lastSyncedAt) {
		const d = new Date(connection.lastSyncedAt);
		d.setDate(d.getDate() - SYNC_OVERLAP_DAYS);
		dateFrom = isoDate(d);
	}
	// Never fetch earlier than the user-chosen import floor.
	if (connection.importFromDate && (!dateFrom || connection.importFromDate > dateFrom)) {
		dateFrom = connection.importFromDate;
	}

	let imported = 0;
	let skipped = 0;
	// On the first sync we seed an opening balance so absolute balances reconcile
	// with the bank. Track net signed flow + earliest date per linked account.
	const isFirstSync = !connection.lastSyncedAt;
	const flowByAccount = new Map<string, { net: number; earliest: string }>();

	try {
		for (const link of links) {
			if (!link.accountId) continue;
			const booked = await getAccountTransactions(link.accountUid, dateFrom);
			for (const t of booked as EbTransaction[]) {
				const externalId = ebTransactionExternalId(t);
				const date = ebTransactionDate(t);
				if (!externalId || !date) {
					skipped++;
					continue;
				}
				// Enforce the import floor client-side too (some banks ignore date_from).
				if (connection.importFromDate && date < connection.importFromDate) {
					skipped++;
					continue;
				}
				const raw = Number(t.transaction_amount.amount);
				if (!Number.isFinite(raw) || raw === 0) {
					skipped++;
					continue;
				}
				const isInflow = ebTransactionIsInflow(t);

				// Accumulate net flow regardless of dedupe — opening = balance − all flow.
				const flow = flowByAccount.get(link.accountId) ?? { net: 0, earliest: date };
				flow.net += isInflow ? Math.abs(raw) : -Math.abs(raw);
				if (date < flow.earliest) flow.earliest = date;
				flowByAccount.set(link.accountId, flow);

				const description = ebTransactionDescription(t);
				const counterpartId = resolveCounterpart(description, isInflow, rules, uncategorized);
				const created = await insertImported({
					workspaceId: connection.workspaceId,
					externalId,
					date,
					description,
					bankAccountId: link.accountId,
					counterpartId,
					isInflow,
					amount: Math.abs(raw),
					currency: t.transaction_amount.currency,
					baseCurrency,
				});
				if (created) imported++;
				else skipped++;
			}
		}

		if (isFirstSync) {
			for (const link of links) {
				if (!link.accountId) continue;
				const flow = flowByAccount.get(link.accountId);
				const openingDate = connection.importFromDate
					? dayBefore(connection.importFromDate)
					: flow
						? dayBefore(flow.earliest)
						: undefined;
				if (!openingDate) continue;
				await ensureOpeningBalance({
					workspaceId: connection.workspaceId,
					accountUid: link.accountUid,
					kurojiAccountId: link.accountId,
					netImported: flow?.net ?? 0,
					openingDate,
					baseCurrency,
				});
			}
		}

		await db
			.update(bankConnections)
			.set({ lastSyncedAt: new Date(), status: "LINKED", lastError: null })
			.where(eq(bankConnections.id, connection.id));

		return { imported, skipped };
	} catch (e) {
		const message = e instanceof Error ? e.message : "Unknown sync error";
		await db
			.update(bankConnections)
			.set({
				status: startsExpired(message) ? "EXPIRED" : "ERROR",
				lastError: message.slice(0, 500),
			})
			.where(eq(bankConnections.id, connection.id));
		throw e;
	}
}
