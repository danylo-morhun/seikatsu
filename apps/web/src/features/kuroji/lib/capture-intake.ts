// Apple Pay payments from the iPhone Shortcut, and how bank imports meet them.
// No auth here — the route checks the key, import callers authorize first.

import { createHash } from "node:crypto";
import {
	and,
	db,
	desc,
	eq,
	gte,
	kurojiCaptureKeys,
	kurojiCaptures,
	like,
	lte,
	transactionEntries,
	transactions,
	workspaces,
} from "@seikatsu/db";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** The transaction a saved capture becomes carries this id until a bank import claims it. */
export const CAPTURE_EXTERNAL_PREFIX = "applepay:";

// A card payment books on the day it was made or up to a few days later.
const BOOKING_LAG_DAYS = 4;

export function hashCaptureKey(key: string): string {
	return createHash("sha256").update(key).digest("hex");
}

export async function workspaceOfCaptureKey(key: string) {
	const [row] = await db
		.select({ id: workspaces.id, baseCurrency: workspaces.baseCurrency })
		.from(kurojiCaptureKeys)
		.innerJoin(workspaces, eq(workspaces.id, kurojiCaptureKeys.workspaceId))
		.where(eq(kurojiCaptureKeys.keyHash, hashCaptureKey(key)))
		.limit(1);
	return row ?? null;
}

export async function recordCapture(
	workspaceId: string,
	payment: { amount: number; currency: string; merchant: string; card: string | null },
): Promise<string> {
	const [row] = await db
		.insert(kurojiCaptures)
		.values({ workspaceId, ...payment, amount: payment.amount.toFixed(4) })
		.returning({ id: kurojiCaptures.id });
	await db
		.update(kurojiCaptureKeys)
		.set({ lastUsedAt: new Date() })
		.where(eq(kurojiCaptureKeys.workspaceId, workspaceId));
	return row.id;
}

function shiftDay(isoDay: string, days: number): string {
	const d = new Date(`${isoDay}T00:00:00Z`);
	d.setUTCDate(d.getUTCDate() + days);
	return d.toISOString().slice(0, 10);
}

type Booked = {
	workspaceId: string;
	externalId: string;
	date: string;
	bankAccountId: string;
	amount: number;
	currency: string;
};

/**
 * A card payment the bank booked may already be in the ledger, saved from Apple Pay.
 * If so it takes the bank's id (so later syncs skip it) and true is returned.
 */
export async function claimSavedCapture(tx: Tx, booked: Booked): Promise<boolean> {
	const [saved] = await tx
		.select({ id: transactions.id })
		.from(transactions)
		.innerJoin(transactionEntries, eq(transactionEntries.transactionId, transactions.id))
		.where(
			and(
				eq(transactions.workspaceId, booked.workspaceId),
				like(transactions.externalId, `${CAPTURE_EXTERNAL_PREFIX}%`),
				eq(transactionEntries.accountId, booked.bankAccountId),
				eq(transactionEntries.currency, booked.currency),
				eq(transactionEntries.amount, (-booked.amount).toFixed(4)),
				gte(transactions.date, shiftDay(booked.date, -BOOKING_LAG_DAYS)),
				// A payment late in the evening can carry the next day in the phone's zone.
				lte(transactions.date, shiftDay(booked.date, 1)),
			),
		)
		.orderBy(desc(transactions.date))
		.limit(1);
	if (!saved) return false;
	await tx
		.update(transactions)
		.set({ externalId: booked.externalId })
		.where(eq(transactions.id, saved.id));
	return true;
}

/** A payment still waiting in the inbox that the bank just booked leaves the inbox. */
export async function settlePendingCapture(
	tx: Tx,
	booked: Omit<Booked, "externalId" | "bankAccountId"> & { transactionId: string },
): Promise<void> {
	const [pending] = await tx
		.select({ id: kurojiCaptures.id })
		.from(kurojiCaptures)
		.where(
			and(
				eq(kurojiCaptures.workspaceId, booked.workspaceId),
				eq(kurojiCaptures.state, "pending"),
				eq(kurojiCaptures.currency, booked.currency),
				eq(kurojiCaptures.amount, booked.amount.toFixed(4)),
				gte(
					kurojiCaptures.paidAt,
					new Date(`${shiftDay(booked.date, -BOOKING_LAG_DAYS)}T00:00:00Z`),
				),
				lte(kurojiCaptures.paidAt, new Date(`${shiftDay(booked.date, 2)}T00:00:00Z`)),
			),
		)
		.orderBy(desc(kurojiCaptures.paidAt))
		.limit(1);
	if (!pending) return;
	await tx
		.update(kurojiCaptures)
		.set({ state: "matched", transactionId: booked.transactionId })
		.where(eq(kurojiCaptures.id, pending.id));
}
