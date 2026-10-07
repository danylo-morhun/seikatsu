// Recurring transaction generation, shared by the daily cron, recurring mutations and a
// post-response fallback on the Kuroji page. Not a "use server" module — no auth here;
// callers must pass a workspace they already authorized (or run as the cron).

import { getExchangeRate } from "@/features/kuroji/lib/exchange-rates";
import {
	and,
	db,
	eq,
	gte,
	isNull,
	lte,
	or,
	recurringTransactions,
	transactionEntries,
	transactions,
} from "@seikatsu/db";

export type Frequency = "daily" | "weekly" | "monthly" | "yearly";

export function advanceDate(dateStr: string, frequency: Frequency): string {
	const [y, m, d] = dateStr.split("-").map(Number);

	if (frequency === "daily" || frequency === "weekly") {
		const dt = new Date(y, m - 1, d);
		dt.setDate(dt.getDate() + (frequency === "daily" ? 1 : 7));
		return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
	}

	if (frequency === "monthly") {
		// next month in 0-indexed; wrap Dec→Jan
		const nm = m % 12; // 0-indexed next month (Jan=0)
		const ny = m === 12 ? y + 1 : y;
		const cap = new Date(ny, nm + 1, 0).getDate(); // last day of next month
		return `${ny}-${String(nm + 1).padStart(2, "0")}-${String(Math.min(d, cap)).padStart(2, "0")}`;
	}

	// yearly — clamp Feb 29 → Feb 28 in non-leap years
	const cap = new Date(y + 1, m, 0).getDate(); // last day of same month next year
	return `${y + 1}-${String(m).padStart(2, "0")}-${String(Math.min(d, cap)).padStart(2, "0")}`;
}

/** Materializes every due period of the workspace's active recurring transactions. */
export async function generateDueForWorkspace(ws: {
	id: string;
	baseCurrency: string;
}): Promise<{ generated: number }> {
	const today = new Date().toISOString().slice(0, 10);

	const due = await db
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

	let generated = 0;
	const MAX_ITERATIONS = 365;

	for (const rt of due) {
		// Fetch every rate this RT needs up front, in parallel and outside the DB transaction,
		// so no connection is held during network I/O. Generation stops at the first gap.
		const rateCache = new Map<string, number>();
		if (rt.currency !== ws.baseCurrency) {
			const dates: string[] = [];
			for (let d = rt.nextDate; d <= today && dates.length < MAX_ITERATIONS; ) {
				if (rt.endDate && d > rt.endDate) break;
				dates.push(d);
				d = advanceDate(d, rt.frequency as Frequency);
			}
			const rates = await Promise.allSettled(
				dates.map((d) => getExchangeRate(rt.currency, ws.baseCurrency, d)),
			);
			for (const [i, r] of rates.entries()) {
				if (r.status === "rejected") break;
				rateCache.set(dates[i], r.value);
			}
		}

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
				let baseAmount: number;
				if (rt.currency === ws.baseCurrency) {
					baseAmount = amount;
				} else {
					const rate = rateCache.get(currentDate);
					if (rate === undefined) break;
					baseAmount = amount * rate;
				}

				const [txn] = await tx
					.insert(transactions)
					.values({ workspaceId: ws.id, date: currentDate, description: rt.description })
					.returning();

				await tx.insert(transactionEntries).values([
					{
						transactionId: txn.id,
						accountId: rt.fromAccountId,
						amount: String(-amount),
						currency: rt.currency,
						baseAmount: (-baseAmount).toFixed(4),
					},
					{
						transactionId: txn.id,
						accountId: rt.toAccountId,
						amount: String(amount),
						currency: rt.currency,
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
