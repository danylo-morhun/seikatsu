// Recurring transaction generation, shared by the daily cron, recurring mutations and a
// post-response fallback on the Kuroji page. Not a "use server" module — no auth here;
// callers must pass a workspace they already authorized (or run as the cron).

import {
	accounts,
	and,
	db,
	eq,
	gte,
	inArray,
	isNull,
	lte,
	or,
	recurringTransactions,
	transactionEntries,
	transactions,
} from "@seikatsu/db";
import { getExchangeRate } from "@/features/kuroji/lib/exchange-rates";

import { advanceDate, type Frequency } from "@/features/kuroji/lib/recurring-dates";

export { advanceDate, type Frequency };

/**
 * Materializes every due period of the workspace's active recurring transactions, up to
 * `today` — the user's day, not the server's. Each side is stored in its own account's
 * currency (converted at the day's rate), as the transaction form does.
 */
export async function generateDueForWorkspace(
	ws: { id: string; baseCurrency: string },
	today: string,
): Promise<{ generated: number }> {
	const rows = await db
		.select()
		.from(recurringTransactions)
		.where(
			and(
				eq(recurringTransactions.workspaceId, ws.id),
				eq(recurringTransactions.isActive, true),
				lte(recurringTransactions.nextDate, today),
				or(
					isNull(recurringTransactions.endDate),
					gte(recurringTransactions.endDate, recurringTransactions.nextDate),
				),
			),
		);
	if (rows.length === 0) return { generated: 0 };
	const accountIds = [...new Set(rows.flatMap((r) => [r.fromAccountId, r.toAccountId]))];
	const currencyOf = new Map(
		(
			await db
				.select({ id: accounts.id, currency: accounts.currency })
				.from(accounts)
				.where(and(eq(accounts.workspaceId, ws.id), inArray(accounts.id, accountIds)))
		).map((a) => [a.id, a.currency]),
	);
	const due = rows.map((rt) => ({
		...rt,
		fromCurrency: currencyOf.get(rt.fromAccountId) ?? rt.currency,
		toCurrency: currencyOf.get(rt.toAccountId) ?? rt.currency,
	}));

	let generated = 0;
	const MAX_ITERATIONS = 365;

	for (const rt of due) {
		// Fetch every rate this RT needs up front, in parallel and outside the DB transaction,
		// so no connection is held during network I/O. Generation stops at the first gap.
		// Rates from the recurring currency to the base and to each side's account currency.
		const targets = [
			...new Set(
				[ws.baseCurrency, rt.fromCurrency, rt.toCurrency].filter((c) => c !== rt.currency),
			),
		];
		const rateCache = new Map<string, number>();
		if (targets.length > 0) {
			const dates: string[] = [];
			for (let d = rt.nextDate; d <= today && dates.length < MAX_ITERATIONS; ) {
				if (rt.endDate && d > rt.endDate) break;
				dates.push(d);
				d = advanceDate(d, rt.frequency as Frequency);
			}
			const pairs = dates.flatMap((d) => targets.map((to) => ({ d, to })));
			const rates = await Promise.allSettled(
				pairs.map(({ d, to }) => getExchangeRate(rt.currency, to, d)),
			);
			for (const [i, r] of rates.entries()) {
				if (r.status === "fulfilled") rateCache.set(`${pairs[i].d}:${pairs[i].to}`, r.value);
			}
		}
		/** The amount in another currency on that day; undefined when its rate is missing. */
		const inCurrency = (amount: number, to: string, date: string) => {
			if (to === rt.currency) return amount;
			const rate = rateCache.get(`${date}:${to}`);
			return rate === undefined ? undefined : amount * rate;
		};

		let rtGenerated = 0;

		await db.transaction(async (tx) => {
			// SELECT FOR UPDATE serializes concurrent calls: the second concurrent
			// request will wait here, then see nextDate already advanced and bail.
			const [locked] = await tx
				.select({ id: recurringTransactions.id })
				.from(recurringTransactions)
				.where(
					and(eq(recurringTransactions.id, rt.id), eq(recurringTransactions.nextDate, rt.nextDate)),
				)
				.for("update")
				.limit(1);

			if (!locked) return;

			let currentDate = rt.nextDate;
			let iterations = 0;

			while (currentDate <= today && iterations < MAX_ITERATIONS) {
				if (rt.endDate && currentDate > rt.endDate) break;

				const amount = Number(rt.amount);
				// Generation stops at the first day a rate is missing; the next run resumes there.
				const baseAmount = inCurrency(amount, ws.baseCurrency, currentDate);
				const fromAmount = inCurrency(amount, rt.fromCurrency, currentDate);
				const toAmount = inCurrency(amount, rt.toCurrency, currentDate);
				if (baseAmount === undefined || fromAmount === undefined || toAmount === undefined) break;

				const [txn] = await tx
					.insert(transactions)
					.values({ workspaceId: ws.id, date: currentDate, description: rt.description })
					.returning();

				await tx.insert(transactionEntries).values([
					{
						transactionId: txn.id,
						accountId: rt.fromAccountId,
						amount: (-fromAmount).toFixed(4),
						currency: rt.fromCurrency,
						baseAmount: (-baseAmount).toFixed(4),
					},
					{
						transactionId: txn.id,
						accountId: rt.toAccountId,
						amount: toAmount.toFixed(4),
						currency: rt.toCurrency,
						baseAmount: baseAmount.toFixed(4),
					},
				]);

				rtGenerated++;
				currentDate = advanceDate(currentDate, rt.frequency as Frequency);
				iterations++;
			}

			// Only advance nextDate when we actually processed at least one period.
			if (rtGenerated > 0) {
				await tx
					.update(recurringTransactions)
					.set({ nextDate: currentDate, updatedAt: new Date() })
					.where(eq(recurringTransactions.id, rt.id));
			}
		});

		generated += rtGenerated;
	}

	return { generated };
}
