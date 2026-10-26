"use server";

import { randomBytes } from "node:crypto";
import { auth } from "@/auth";
import { cardMarkups } from "@/features/kuroji/lib/apple-pay";
import { hashCaptureKey } from "@/features/kuroji/lib/capture-intake";
import { getExchangeRate } from "@/features/kuroji/lib/exchange-rates";
import { matchRule } from "@/features/kuroji/lib/import-core";
import { getOwnedWorkspace, isUuid } from "@/lib/session";
import { dayIn, getUserTimeZone } from "@/lib/timezone";
import {
	accounts,
	and,
	asc,
	bankRules,
	db,
	desc,
	eq,
	inArray,
	isNull,
	kurojiCaptureKeys,
	kurojiCaptures,
	transactionEntries,
} from "@seikatsu/db";
import { revalidatePath } from "next/cache";

type Result<T = unknown> = { error: string } | ({ success: true } & T);

async function owned(workspaceId: string) {
	const session = await auth();
	if (!session?.user?.id) return null;
	return getOwnedWorkspace(workspaceId);
}

// ── The inbox ──

export type PendingCapture = {
	id: string;
	amount: number;
	currency: string;
	merchant: string;
	card: string | null;
	/** When it was paid, in the user's zone: YYYY-MM-DD and HH:mm. */
	day: string;
	time: string;
	/** The account this card paid from last time, if any. */
	walletId: string | null;
	/** Where this merchant went last time, else the first import rule that matches it. */
	categoryId: string | null;
	/**
	 * One unit of the payment's currency in each other wallet currency, on the day it was
	 * paid: the official rate times what the card's bank charged on top before.
	 */
	rates: Record<string, number>;
};

// How far back the guesses look.
const HISTORY = 300;
// Converted payments a markup is learned from, and pending ones that get rates.
const MARKUP_SAMPLES = 10;
const RATED = 5;

/** Payments waiting to be added, newest first, each with what the last ones suggest. */
export async function getPendingCaptures(workspaceId: string): Promise<PendingCapture[]> {
	if (!(await owned(workspaceId))) return [];
	const pending = await db
		.select()
		.from(kurojiCaptures)
		.where(and(eq(kurojiCaptures.workspaceId, workspaceId), eq(kurojiCaptures.state, "pending")))
		.orderBy(desc(kurojiCaptures.paidAt))
		.limit(20);
	if (pending.length === 0) return [];

	const timeZone = await getUserTimeZone();
	const clock = new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit" });
	const [history, rules, walletCurrencies] = await Promise.all([
		db
			.select({
				card: kurojiCaptures.card,
				merchant: kurojiCaptures.merchant,
				paid: kurojiCaptures.amount,
				paidCurrency: kurojiCaptures.currency,
				paidAt: kurojiCaptures.paidAt,
				accountId: transactionEntries.accountId,
				amount: transactionEntries.amount,
				currency: transactionEntries.currency,
			})
			.from(kurojiCaptures)
			.innerJoin(
				transactionEntries,
				eq(transactionEntries.transactionId, kurojiCaptures.transactionId),
			)
			.innerJoin(accounts, eq(accounts.id, transactionEntries.accountId))
			.where(
				and(
					eq(kurojiCaptures.workspaceId, workspaceId),
					eq(kurojiCaptures.state, "added"),
					isNull(accounts.archivedAt),
				),
			)
			.orderBy(desc(kurojiCaptures.paidAt))
			.limit(HISTORY),
		db
			.select({ matchText: bankRules.matchText, accountId: bankRules.accountId })
			.from(bankRules)
			.where(eq(bankRules.workspaceId, workspaceId))
			.orderBy(asc(bankRules.priority), asc(bankRules.createdAt)),
		db
			.selectDistinct({ currency: accounts.currency })
			.from(accounts)
			.where(
				and(
					eq(accounts.workspaceId, workspaceId),
					inArray(accounts.type, ["ASSET", "LIABILITY"]),
					isNull(accounts.archivedAt),
				),
			),
	]);
	// Rates are cached per day, so this is the network only the first time a day is seen.
	const official = (from: string, to: string, day: string) =>
		getExchangeRate(from, to, day).catch(() => null);

	// A UAH card paying in PLN: what left the card, against the official rate that day.
	const converted = history
		.filter((h) => Number(h.amount) < 0 && h.currency !== h.paidCurrency)
		.slice(0, MARKUP_SAMPLES);
	const samples = await Promise.all(
		converted.map(async (h) => {
			const rate = await official(h.paidCurrency, h.currency, dayIn(timeZone, h.paidAt));
			const effective = -Number(h.amount) / Number(h.paid);
			return {
				pair: `${h.paidCurrency}>${h.currency}`,
				ratio: rate ? effective / rate : Number.NaN,
			};
		}),
	);
	const markups = cardMarkups(samples);

	async function ratesFor(currency: string, day: string) {
		const rates: Record<string, number> = {};
		for (const { currency: to } of walletCurrencies) {
			if (to === currency) continue;
			const rate = await official(currency, to, day);
			if (rate) rates[to] = rate * (markups.get(`${currency}>${to}`) ?? 1);
		}
		return rates;
	}

	// Newest first, so the first one seen per card / merchant wins.
	const walletByCard = new Map<string, string>();
	const categoryByMerchant = new Map<string, string>();
	for (const h of history) {
		if (Number(h.amount) < 0) {
			if (h.card && !walletByCard.has(h.card)) walletByCard.set(h.card, h.accountId);
		} else {
			const key = h.merchant.toLowerCase();
			if (!categoryByMerchant.has(key)) categoryByMerchant.set(key, h.accountId);
		}
	}

	return Promise.all(
		pending.map(async (c, i) => {
			const day = dayIn(timeZone, c.paidAt);
			return {
				id: c.id,
				amount: Number(c.amount),
				currency: c.currency,
				merchant: c.merchant,
				card: c.card,
				day,
				time: clock.format(c.paidAt),
				walletId: (c.card && walletByCard.get(c.card)) || null,
				categoryId:
					categoryByMerchant.get(c.merchant.toLowerCase()) ?? matchRule(c.merchant, rules),
				rates: i < RATED ? await ratesFor(c.currency, day) : {},
			};
		}),
	);
}

export async function dismissCapture(captureId: string): Promise<Result> {
	const session = await auth();
	if (!session?.user?.id) return { error: "Unauthorized" };
	if (!isUuid(captureId)) return { error: "Payment not found" };
	const [row] = await db
		.select({ workspaceId: kurojiCaptures.workspaceId })
		.from(kurojiCaptures)
		.where(eq(kurojiCaptures.id, captureId))
		.limit(1);
	if (!row || !(await getOwnedWorkspace(row.workspaceId))) return { error: "Payment not found" };
	await db
		.update(kurojiCaptures)
		.set({ state: "dismissed" })
		.where(and(eq(kurojiCaptures.id, captureId), eq(kurojiCaptures.state, "pending")));
	revalidatePath("/kuroji", "layout");
	return { success: true };
}

// ── The Shortcut's key ──

export type CaptureKeyStatus = { createdAt: string; lastUsedAt: string | null };

export async function getCaptureKeyStatus(workspaceId: string): Promise<CaptureKeyStatus | null> {
	if (!(await owned(workspaceId))) return null;
	const [row] = await db
		.select({ createdAt: kurojiCaptureKeys.createdAt, lastUsedAt: kurojiCaptureKeys.lastUsedAt })
		.from(kurojiCaptureKeys)
		.where(eq(kurojiCaptureKeys.workspaceId, workspaceId))
		.limit(1);
	return row
		? { createdAt: row.createdAt.toISOString(), lastUsedAt: row.lastUsedAt?.toISOString() ?? null }
		: null;
}

/** A new key for the Shortcut; the old one stops working. Shown once, stored hashed. */
export async function createCaptureKey(workspaceId: string): Promise<Result<{ key: string }>> {
	if (!(await owned(workspaceId))) return { error: "Forbidden" };
	const key = `kuroji_${randomBytes(32).toString("base64url")}`;
	await db
		.insert(kurojiCaptureKeys)
		.values({ workspaceId, keyHash: hashCaptureKey(key) })
		.onConflictDoUpdate({
			target: kurojiCaptureKeys.workspaceId,
			set: { keyHash: hashCaptureKey(key), createdAt: new Date(), lastUsedAt: null },
		});
	revalidatePath("/settings/kuroji");
	return { success: true, key };
}

export async function deleteCaptureKey(workspaceId: string): Promise<Result> {
	if (!(await owned(workspaceId))) return { error: "Forbidden" };
	await db.delete(kurojiCaptureKeys).where(eq(kurojiCaptureKeys.workspaceId, workspaceId));
	revalidatePath("/settings/kuroji");
	return { success: true };
}
