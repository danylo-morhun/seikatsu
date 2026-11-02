import { and, db, desc, eq, exchangeRates, inArray, lte } from "@seikatsu/db";
import { after } from "next/server";
import { cache } from "react";

const CURRENCY_RE = /^[A-Z]{3}$/;

function withTimeout(ms: number) {
	const controller = new AbortController();
	const id = setTimeout(() => controller.abort(), ms);
	return { signal: controller.signal, done: () => clearTimeout(id) };
}

// Frankfurter (ECB) — broad coverage but no UAH and a handful of other
// non-ECB currencies. Historical by date.
async function fetchFrankfurter(
	fromCurrency: string,
	toCurrency: string,
	date: string,
): Promise<number> {
	const t = withTimeout(5000);
	let res: Response;
	try {
		res = await fetch(
			`https://api.frankfurter.dev/v1/${date}?from=${fromCurrency}&to=${toCurrency}`,
			{
				signal: t.signal,
			},
		);
	} finally {
		t.done();
	}
	if (!res.ok) throw new Error(`Exchange rate fetch failed: ${res.status}`);
	const data = (await res.json()) as { rates: Record<string, number> };
	const rate = data.rates[toCurrency];
	if (rate == null) throw new Error(`No rate for ${fromCurrency}→${toCurrency}`);
	return rate;
}

type PrivatRate = {
	currency: string;
	saleRateNB?: number;
	purchaseRateNB?: number;
	saleRate?: number;
	purchaseRate?: number;
};

// PrivatBank's public rate archive covers UAH against major currencies (NBU
// official rates). Used for any pair involving UAH, which Frankfurter lacks.
// Rates are quoted as UAH per 1 unit of the listed currency.
async function fetchPrivatBankList(date: string): Promise<PrivatRate[]> {
	// PrivatBank wants DD.MM.YYYY.
	const [y, m, d] = date.split("-");
	const t = withTimeout(5000);
	let res: Response;
	try {
		res = await fetch(`https://api.privatbank.ua/p24api/exchange_rates?json&date=${d}.${m}.${y}`, {
			signal: t.signal,
		});
	} finally {
		t.done();
	}
	if (!res.ok) throw new Error(`Exchange rate fetch failed: ${res.status}`);
	const data = (await res.json()) as { exchangeRate?: PrivatRate[] };
	return data.exchangeRate ?? [];
}

// The archive for today (and some weekends/holidays) comes back empty until
// it is published, so walk back to the latest day that has the rate.
const PRIVAT_LOOKBACK_DAYS = 7;

async function fetchPrivatBankRate(
	fromCurrency: string,
	toCurrency: string,
	date: string,
): Promise<number> {
	const day = new Date(`${date}T00:00:00Z`);
	for (let i = 0; i <= PRIVAT_LOOKBACK_DAYS; i++) {
		const list = await fetchPrivatBankList(day.toISOString().slice(0, 10));

		// UAH per 1 unit of `cur`. UAH itself is 1.
		const uahPer = (cur: string): number | null => {
			if (cur === "UAH") return 1;
			const e = list.find((r) => r.currency === cur);
			const rate = e?.saleRateNB ?? e?.purchaseRateNB ?? e?.saleRate ?? e?.purchaseRate;
			return rate != null && Number.isFinite(rate) && rate > 0 ? rate : null;
		};

		const fromUah = uahPer(fromCurrency);
		const toUah = uahPer(toCurrency);
		// 1 from = fromUah UAH; 1 to = toUah UAH → 1 from = fromUah/toUah to.
		if (fromUah != null && toUah != null) return fromUah / toUah;
		day.setUTCDate(day.getUTCDate() - 1);
	}
	throw new Error(`No PrivatBank rate for ${fromCurrency}→${toCurrency} on ${date}`);
}

/** The rate from the right source: PrivatBank for UAH pairs (Frankfurter has no UAH). */
function fetchRate(fromCurrency: string, toCurrency: string, date: string): Promise<number> {
	const involvesUah = fromCurrency === "UAH" || toCurrency === "UAH";
	return involvesUah
		? fetchPrivatBankRate(fromCurrency, toCurrency, date)
		: fetchFrankfurter(fromCurrency, toCurrency, date);
}

// Per-instance memory. A stored rate never changes, so exact-date hits stay; failures are
// kept briefly so a down API doesn't add a timeout to every render.
const FAILURE_TTL_MS = 10 * 60 * 1000;
const MAX_KNOWN = 5000;
const known = new Map<string, number>();
const failedUntil = new Map<string, number>();
const refreshing = new Set<string>();

const keyOf = (from: string, to: string, date: string) => `${from}>${to}@${date}`;

function remember(key: string, rate: number) {
	if (known.size >= MAX_KNOWN) known.clear();
	known.set(key, rate);
}

const recentlyFailed = (key: string) => (failedUntil.get(key) ?? 0) > Date.now();
const markFailed = (key: string) => failedUntil.set(key, Date.now() + FAILURE_TTL_MS);

async function fetchAndStore(from: string, to: string, date: string): Promise<number> {
	const rate = await fetchRate(from, to, date);
	await db
		.insert(exchangeRates)
		.values({ date, fromCurrency: from, toCurrency: to, rate: String(rate) })
		.onConflictDoNothing();
	remember(keyOf(from, to, date), rate);
	return rate;
}

/**
 * The exact rate for `date`, from the API if not stored yet. For writes: base amounts
 * use the transaction date's rate. Throws when there is no rate.
 */
export async function getExchangeRate(
	fromCurrency: string,
	toCurrency: string,
	date: string,
): Promise<number> {
	if (!CURRENCY_RE.test(fromCurrency) || !CURRENCY_RE.test(toCurrency)) {
		throw new Error(`Invalid currency code: ${fromCurrency} / ${toCurrency}`);
	}
	const key = keyOf(fromCurrency, toCurrency, date);
	const hit = known.get(key);
	if (hit != null) return hit;

	const [row] = await db
		.select({ rate: exchangeRates.rate })
		.from(exchangeRates)
		.where(
			and(
				eq(exchangeRates.date, date),
				eq(exchangeRates.fromCurrency, fromCurrency),
				eq(exchangeRates.toCurrency, toCurrency),
			),
		)
		.limit(1);
	if (row) {
		const rate = Number(row.rate);
		remember(key, rate);
		return rate;
	}
	return fetchAndStore(fromCurrency, toCurrency, date);
}

/** Fetch the day's rate after the response, once per instance at a time. */
function refreshLater(from: string, to: string, date: string) {
	const key = keyOf(from, to, date);
	if (refreshing.has(key) || recentlyFailed(key)) return;
	refreshing.add(key);
	const task = () =>
		fetchAndStore(from, to, date)
			.catch(() => markFailed(key))
			.finally(() => refreshing.delete(key));
	try {
		after(task);
	} catch {
		// Outside a request (scripts): just run it.
		void task();
	}
}

/** The rate for render: the latest stored on or before `date`; the API only on first use. */
async function settle(
	from: string,
	to: string,
	date: string,
	latest: { date: string; rate: string } | undefined,
): Promise<number | null> {
	const key = keyOf(from, to, date);
	if (latest) {
		if (latest.date === date) remember(key, Number(latest.rate));
		else refreshLater(from, to, date);
		return Number(latest.rate);
	}
	if (recentlyFailed(key)) return null;
	try {
		return await fetchAndStore(from, to, date);
	} catch {
		markFailed(key);
		return null;
	}
}

// Memoized per request; `currencies` is a sorted comma list so the cache key is a string.
const ratesFor = cache(
	async (currencies: string, base: string, date: string): Promise<[string, number | null][]> => {
		const out = new Map<string, number | null>();
		const missing: string[] = [];
		for (const c of currencies.split(",").filter(Boolean)) {
			const hit = known.get(keyOf(c, base, date));
			if (c === base) out.set(c, 1);
			else if (!CURRENCY_RE.test(c) || !CURRENCY_RE.test(base)) out.set(c, null);
			else if (hit != null) out.set(c, hit);
			else missing.push(c);
		}
		if (missing.length === 0) return [...out];

		const rows = await db
			.selectDistinctOn([exchangeRates.fromCurrency], {
				from: exchangeRates.fromCurrency,
				date: exchangeRates.date,
				rate: exchangeRates.rate,
			})
			.from(exchangeRates)
			.where(
				and(
					eq(exchangeRates.toCurrency, base),
					inArray(exchangeRates.fromCurrency, missing),
					lte(exchangeRates.date, date),
				),
			)
			.orderBy(exchangeRates.fromCurrency, desc(exchangeRates.date));
		const latest = new Map(rows.map((r) => [r.from, r]));
		const settled = await Promise.all(missing.map((c) => settle(c, base, date, latest.get(c))));
		for (const [i, c] of missing.entries()) out.set(c, settled[i] ?? null);
		return [...out];
	},
);

/**
 * One rate per currency into `base`, for display; null when none is known. Never waits on
 * the API once a pair has any stored rate: a missing day is fetched after the response.
 */
export async function getRates(
	currencies: Iterable<string>,
	base: string,
	date: string,
): Promise<Map<string, number | null>> {
	const list = [...new Set(currencies)].sort();
	return new Map(await ratesFor(list.join(","), base, date));
}

/** One display rate; see `getRates`. */
export async function getRate(from: string, to: string, date: string): Promise<number | null> {
	return (await getRates([from], to, date)).get(from) ?? null;
}
