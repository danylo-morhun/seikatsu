// Read-side queries for captures. Not a "use server" module, so nothing here is
// callable from the client — import only from RSC pages or server actions.

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
import { auth } from "@/auth";
import { cardMarkups } from "@/features/kuroji/lib/apple-pay";
import { getRate } from "@/features/kuroji/lib/exchange-rates";
import { matchRule } from "@/features/kuroji/lib/import-core";
import { getOwnedWorkspace } from "@/lib/session";
import { dayIn, getUserTimeZone } from "@/lib/timezone";

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
// Converted payments a markup is learned from.
const MARKUP_SAMPLES = 10;

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
	const [history, rules, wallets] = await Promise.all([
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
			.select({ id: accounts.id, name: accounts.name, currency: accounts.currency })
			.from(accounts)
			.where(
				and(
					eq(accounts.workspaceId, workspaceId),
					inArray(accounts.type, ["ASSET", "LIABILITY"]),
					isNull(accounts.archivedAt),
				),
			),
	]);
	// Display rates: the latest stored on or before the day; the network only on first use.
	const official = (from: string, to: string, day: string) => getRate(from, to, day);

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

	// Every payment gets them, so each opens in its card's currency, not only the newest few.
	const walletCurrencies = [...new Set(wallets.map((w) => w.currency))];
	const rateCache = new Map<string, Promise<Record<string, number>>>();
	function ratesFor(currency: string, day: string) {
		const key = `${currency}:${day}`;
		let rates = rateCache.get(key);
		if (!rates) {
			rates = (async () => {
				const out: Record<string, number> = {};
				for (const to of walletCurrencies) {
					if (to === currency) continue;
					const rate = await official(currency, to, day);
					if (rate) out[to] = rate * (markups.get(`${currency}>${to}`) ?? 1);
				}
				return out;
			})();
			rateCache.set(key, rates);
		}
		return rates;
	}

	/**
	 * A card never added before: the one wallet its name points at most ("Privat UAH" →
	 * "PrivatBank"), by the words they share. A tie is no guess.
	 */
	function walletByName(card: string): string | null {
		const words = card.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) ?? [];
		let best: string | null = null;
		let top = 0;
		let tie = false;
		for (const w of wallets) {
			const name = w.name.toLowerCase();
			const score = words.filter((word) => name.includes(word)).length;
			if (score > top) [best, top, tie] = [w.id, score, false];
			else if (score === top && score > 0) tie = true;
		}
		return top > 0 && !tie ? best : null;
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
		pending.map(async (c) => {
			const day = dayIn(timeZone, c.paidAt);
			return {
				id: c.id,
				amount: Number(c.amount),
				currency: c.currency,
				merchant: c.merchant,
				card: c.card,
				day,
				time: clock.format(c.paidAt),
				walletId: c.card ? (walletByCard.get(c.card) ?? walletByName(c.card)) : null,
				categoryId:
					categoryByMerchant.get(c.merchant.toLowerCase()) ?? matchRule(c.merchant, rules),
				rates: await ratesFor(c.currency, day),
			};
		}),
	);
}

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
