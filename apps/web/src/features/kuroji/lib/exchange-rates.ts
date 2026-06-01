import { and, db, eq, exchangeRates } from "@seikatsu/db";

const CURRENCY_RE = /^[A-Z]{3}$/;

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

	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), 5000);

	let res: Response;
	try {
		res = await fetch(`https://api.frankfurter.app/${date}?from=${fromCurrency}&to=${toCurrency}`, {
			signal: controller.signal,
		});
	} finally {
		clearTimeout(timeout);
	}

	if (!res.ok) throw new Error(`Exchange rate fetch failed: ${res.status}`);
	const data = (await res.json()) as { rates: Record<string, number> };
	const rate = data.rates[toCurrency];
	if (rate == null) throw new Error(`No rate for ${fromCurrency}→${toCurrency}`);

	await db
		.insert(exchangeRates)
		.values({ date, fromCurrency, toCurrency, rate: String(rate) })
		.onConflictDoNothing();
	return rate;
}
