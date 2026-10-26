// Kuroji's offline-capable mutations: run the action, or queue it when there's no connection
// (lib/overlay.ts shows queued ones in the list until they sync).

import {
	type TransactionInput,
	createTransaction,
	deleteTransaction,
	updateTransaction,
} from "@/features/kuroji/actions/transactions";
import { formatCurrency } from "@/features/kuroji/lib/format";
import { type RunResult, runOrQueue } from "@/features/pwa/lib/run";

const DAY = new Intl.DateTimeFormat("en", { day: "numeric", month: "short", timeZone: "UTC" });

function total(input: TransactionInput) {
	const sum = (list?: { amount: number }[]) => list?.reduce((s, l) => s + l.amount, 0) ?? 0;
	return input.amount ?? (sum(input.toSplits) || sum(input.fromSplits));
}

function label(input: TransactionInput) {
	const what = input.description?.trim() || "Transaction";
	const day = DAY.format(new Date(`${input.date}T00:00:00Z`));
	return `${what} · ${formatCurrency(total(input), input.currency)} · ${day}`;
}

/** A new capture. Its id is made here so a replay (or an edit before it syncs) finds it. */
export function captureTransaction(
	workspaceId: string,
	input: TransactionInput,
): Promise<RunResult> {
	const args = { ...input, workspaceId, id: crypto.randomUUID() };
	return runOrQueue("kuroji.createTransaction", args, label(input), () => createTransaction(args));
}

export function editTransaction(
	transactionId: string,
	input: TransactionInput,
): Promise<RunResult> {
	const args = { ...input, transactionId };
	return runOrQueue("kuroji.updateTransaction", args, `Edit: ${label(input)}`, () =>
		updateTransaction(args),
	);
}

export function removeTransaction(transactionId: string, what: string): Promise<RunResult> {
	return runOrQueue("kuroji.deleteTransaction", { transactionId }, `Delete: ${what}`, () =>
		deleteTransaction(transactionId),
	);
}

export const isQueued = (r: RunResult) => "queued" in r;

/** The toast for a change kept on this device. */
export const QUEUED_TOAST = "Saved on this device. It syncs when you're back online.";
