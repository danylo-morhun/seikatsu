// Kuroji's offline overlay for the transaction list: server rows + queued ops → what to show.
// Pure. Captures made offline appear as pending rows, deletes hide theirs, edits mark theirs.
// Balances and charts wait for the server — they need every entry and the day's rates.

import type { FormAccount } from "@/features/kuroji/actions/form-options";
import type { RecentTransaction, TransactionInput } from "@/features/kuroji/actions/transactions";
import type { Op } from "@/features/pwa/lib/ops";

/** A row that exists only on this device so far. */
export type ShownTransaction = RecentTransaction & { pending?: true };

function legsOf(input: TransactionInput) {
	if (input.toSplits?.length && input.fromAccountId) {
		const total = input.toSplits.reduce((s, l) => s + l.amount, 0);
		return {
			from: input.fromAccountId,
			to: input.toSplits[0].accountId,
			total,
			splits: input.toSplits.length,
		};
	}
	if (input.fromSplits?.length && input.toAccountId) {
		const total = input.fromSplits.reduce((s, l) => s + l.amount, 0);
		return {
			from: input.fromSplits[0].accountId,
			to: input.toAccountId,
			total,
			splits: input.fromSplits.length,
		};
	}
	if (input.fromAccountId && input.toAccountId && input.amount !== undefined) {
		return { from: input.fromAccountId, to: input.toAccountId, total: input.amount, splits: 1 };
	}
	return null;
}

/** Entries as the edit form reads them (debits negative), so a queued capture can be edited. */
function entriesOf(input: TransactionInput, accounts: FormAccount[]): RecentTransaction["legs"] {
	const leg = (accountId: string, amount: number) => {
		const account = accounts.find((a) => a.id === accountId);
		const value = amount.toFixed(4);
		return {
			accountId,
			accountType: account?.type ?? "ASSET",
			amount: value,
			currency: account?.currency ?? input.currency,
			baseAmount: value,
		};
	};
	const sum = (list: { amount: number }[]) => list.reduce((s, l) => s + l.amount, 0);
	if (input.toSplits?.length && input.fromAccountId) {
		return [
			leg(input.fromAccountId, -sum(input.toSplits)),
			...input.toSplits.map((s) => leg(s.accountId, s.amount)),
		];
	}
	if (input.fromSplits?.length && input.toAccountId) {
		return [
			...input.fromSplits.map((s) => leg(s.accountId, -s.amount)),
			leg(input.toAccountId, sum(input.fromSplits)),
		];
	}
	if (input.fromAccountId && input.toAccountId && input.amount !== undefined) {
		return [
			leg(input.fromAccountId, -input.amount),
			leg(input.toAccountId, input.received ?? input.amount),
		];
	}
	return [];
}

/** The queued capture as a list row, with names from the form options cache. */
export function pendingRow(
	id: string,
	input: TransactionInput,
	accounts: FormAccount[],
	baseCurrency: string,
): ShownTransaction | null {
	const legs = legsOf(input);
	if (!legs) return null;
	const from = accounts.find((a) => a.id === legs.from);
	const to = accounts.find((a) => a.id === legs.to);
	const amount = legs.total.toFixed(4);
	return {
		id,
		date: input.date,
		description: input.description ?? null,
		imported: false,
		fromAccount: from?.name ?? "…",
		fromAccountId: legs.from,
		fromAccountType: from?.type ?? "ASSET",
		toAccount: to?.name ?? "…",
		toAccountId: legs.to,
		toAccountType: to?.type ?? "EXPENSE",
		amount,
		currency: input.currency,
		fromAmount: amount,
		fromCurrency: input.currency,
		// The base value needs the day's rate; same-currency is exact, the rest is a placeholder.
		baseAmount: input.currency === baseCurrency ? amount : "0",
		splitCount: legs.splits,
		legs: entriesOf(input, accounts),
		tags: [],
		pending: true,
	};
}

export function overlayTransactions(
	rows: RecentTransaction[],
	ops: Op[],
	accounts: FormAccount[],
	baseCurrency: string,
	opts: { firstPage: boolean; byDateDesc: boolean },
): ShownTransaction[] {
	if (ops.length === 0) return rows;
	const deleted = new Set<string>();
	const edited = new Map<string, TransactionInput>();
	const created = new Map<string, TransactionInput>();
	for (const op of ops) {
		if (op.name === "kuroji.deleteTransaction") {
			const { transactionId } = op.args as { transactionId: string };
			deleted.add(transactionId);
			created.delete(transactionId);
		}
		if (op.name === "kuroji.createTransaction") {
			const {
				id,
				workspaceId: _,
				...input
			} = op.args as TransactionInput & {
				id: string;
				workspaceId: string;
			};
			created.set(id, input);
		}
		if (op.name === "kuroji.updateTransaction") {
			const { transactionId, ...input } = op.args as TransactionInput & { transactionId: string };
			// An edit of an offline capture just replaces what will be sent.
			if (created.has(transactionId)) created.set(transactionId, input);
			else edited.set(transactionId, input);
		}
	}

	const shown: ShownTransaction[] = rows
		.filter((r) => !deleted.has(r.id))
		.map((r) => {
			const input = edited.get(r.id);
			if (!input) return r;
			const next = pendingRow(r.id, input, accounts, baseCurrency);
			// The server's tags stay; everything the edit set shows as queued.
			return next ? { ...next, tags: r.tags } : { ...r, pending: true as const };
		});
	if (!opts.firstPage) return shown;

	const fresh = [...created]
		.map(([id, input]) => pendingRow(id, input, accounts, baseCurrency))
		.filter((r): r is ShownTransaction => r !== null);
	const merged = [...fresh, ...shown];
	return opts.byDateDesc ? merged.sort((a, b) => b.date.localeCompare(a.date)) : merged;
}
