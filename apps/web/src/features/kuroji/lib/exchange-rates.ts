import { and, db, eq, exchangeRates } from "@seikatsu/db";

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
		res = await fetch(`https://api.frankfurter.app/${date}?from=${fromCurrency}&to=${toCurrency}`, {
			signal: t.signal,
		});
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
async function fetchPrivatBankRate(
	fromCurrency: string,
	toCurrency: string,
	date: string,
): Promise<number> {
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
	const list = data.exchangeRate ?? [];

	// UAH per 1 unit of `cur`. UAH itself is 1.
	const uahPer = (cur: string): number | null => {
		if (cur === "UAH") return 1;
		const e = list.find((r) => r.currency === cur);
		const rate = e?.saleRateNB ?? e?.purchaseRateNB ?? e?.saleRate ?? e?.purchaseRate;
		return rate != null && Number.isFinite(rate) && rate > 0 ? rate : null;
	};

	const fromUah = uahPer(fromCurrency);
	const toUah = uahPer(toCurrency);
	if (fromUah == null || toUah == null) {
		throw new Error(`No PrivatBank rate for ${fromCurrency}→${toCurrency} on ${date}`);
	}
	// 1 from = fromUah UAH; 1 to = toUah UAH → 1 from = fromUah/toUah to.
	return fromUah / toUah;
}

export async function getExchangeRate(
	fromCurrency: string,
	toCurrency: string,
	date: string,
): Promise<number> {
	if (!CURRENCY_RE.test(fromCurrency) || !CURRENCY_RE.test(toCurrency)) {
		throw new Error(`Invalid currency code: ${fromCurrency} / ${toCurrency}`);
	}
	const cached = await db
		.select()
		.from(exchangeRates)
		.where(
			and(
				eq(exchangeRates.date, date),
				eq(exchangeRates.fromCurrency, fromCurrency),
				eq(exchangeRates.toCurrency, toCurrency),
			),
		)
		.limit(1);

	if (cached[0]) return Number(cached[0].rate);

	// Frankfurter has no UAH; PrivatBank's archive does. Route accordingly.
	const involvesUah = fromCurrency === "UAH" || toCurrency === "UAH";
	const rate = involvesUah
		? await fetchPrivatBankRate(fromCurrency, toCurrency, date)
		: await fetchFrankfurter(fromCurrency, toCurrency, date);

	await db
		.insert(exchangeRates)
		.values({ date, fromCurrency, toCurrency, rate: String(rate) })
		.onConflictDoNothing();
	return rate;
}
