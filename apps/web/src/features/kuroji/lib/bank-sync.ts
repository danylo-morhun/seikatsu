// Core bank-sync logic shared by the server action (user-triggered) and the
// cron route (system-triggered). No auth here — callers must authorize first.

import {
	and,
	asc,
	bankAccounts,
	bankConnections,
	bankRules,
	db,
	eq,
	isNotNull,
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
import {
	dayBefore,
	ensureUncategorized,
	insertImported,
	isoDate,
	postOpeningBalance,
	resolveCounterpart,
} from "./import-core";

type ConnectionRow = typeof bankConnections.$inferSelect;

export type SyncResult = { imported: number; skipped: number };

// Buffer (days) subtracted from lastSyncedAt so late-posting/amended booked
// transactions are re-fetched. Dedupe by externalId makes the overlap safe.
const SYNC_OVERLAP_DAYS = 3;

// Seed the linked account's starting balance as of the day before the first
// imported transaction. opening = currentBookedBalance − netImportedFlow, so
// once posted the absolute balance reconciles with the bank.
async function ensureOpeningBalance(opts: {
	workspaceId: string;
	accountUid: string;
	kurojiAccountId: string;
	netImported: number; // signed: inflow +, outflow −, in account currency
	openingDate: string;
	baseCurrency: string;
}): Promise<void> {
	const { workspaceId, accountUid, kurojiAccountId, netImported, openingDate, baseCurrency } = opts;

	const balance = await getAccountBalance(accountUid);
	if (!balance) return;

	await postOpeningBalance({
		workspaceId,
		kurojiAccountId,
		externalId: `opening:${accountUid}`,
		opening: balance.amount - netImported,
		openingDate,
		// The bank balance's currency is the account's authoritative currency.
		currency: balance.currency,
		baseCurrency,
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
