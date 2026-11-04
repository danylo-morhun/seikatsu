// What the money waits on today, read without a session (Today, Week and the morning push):
// Apple Pay payments to add, bank payments that landed without a category, and fund
// instalments not paid in yet this month.

import {
	accounts,
	and,
	asc,
	count,
	countDistinct,
	db,
	eq,
	gte,
	inArray,
	kurojiCaptures,
	kurojiFunds,
	transactionEntries,
	transactions,
} from "@seikatsu/db";
import { readBalances } from "@/features/kuroji/actions/balances";
import { displayBalance } from "@/features/kuroji/lib/balance";
import { allocateFunds, monthBounds, shiftMonth } from "@/features/kuroji/lib/plan";

export type FundDue = {
	id: string;
	name: string;
	/** The account the fund lives in: the transfer goes there. */
	accountId: string;
	/** This month's instalment, in the base currency. */
	amount: number;
	currency: string;
	dueDate: string;
};

export type MoneyAgenda = {
	captures: number;
	/** Bank payments of the last 30 days filed under "Uncategorized". */
	uncategorized: number;
	funds: FundDue[];
};

/** The bank sync's fallback categories (lib/import-core.ensureUncategorized). */
const UNCATEGORIZED = ["Uncategorized Expenses", "Uncategorized Income"];

export async function readMoneyAgenda(
	ws: { id: string; baseCurrency: string },
	today: string,
): Promise<MoneyAgenda> {
	const since = shiftDay(today, -30);
	const month = today.slice(0, 7);
	const [[captures], [uncategorized], funds] = await Promise.all([
		db
			.select({ n: count() })
			.from(kurojiCaptures)
			.where(and(eq(kurojiCaptures.workspaceId, ws.id), eq(kurojiCaptures.state, "pending"))),
		db
			.select({ n: countDistinct(transactions.id) })
			.from(transactionEntries)
			.innerJoin(transactions, eq(transactions.id, transactionEntries.transactionId))
			.innerJoin(accounts, eq(accounts.id, transactionEntries.accountId))
			.where(
				and(
					eq(transactions.workspaceId, ws.id),
					inArray(accounts.name, UNCATEGORIZED),
					gte(transactions.date, since),
				),
			),
		readFundsDue(ws, month, today),
	]);
	return { captures: captures?.n ?? 0, uncategorized: uncategorized?.n ?? 0, funds };
}

/** Funds whose instalment this month isn't in their account yet (the Plan tab's ✓). */
async function readFundsDue(
	ws: { id: string; baseCurrency: string },
	month: string,
	today: string,
): Promise<FundDue[]> {
	const rows = await db
		.select()
		.from(kurojiFunds)
		.where(eq(kurojiFunds.workspaceId, ws.id))
		.orderBy(asc(kurojiFunds.dueDate));
	if (rows.length === 0) return [];
	const prevMonthEnd = monthBounds(shiftMonth(month, -1)).to;
	const [now, atStart] = await Promise.all([
		readBalances(ws, undefined, today, today),
		readBalances(ws, undefined, prevMonthEnd, today),
	]);
	const assets = (list: typeof now) =>
		new Map(
			list
				.filter((b) => b.type === "ASSET")
				.map((b) => [b.accountId, displayBalance("ASSET", Number(b.balance))]),
		);
	return allocateFunds(
		rows.map((f) => ({
			id: f.id,
			name: f.name,
			accountId: f.accountId,
			target: Number(f.target),
			dueDate: f.dueDate,
		})),
		month,
		assets(now),
		assets(atStart),
	)
		.filter((f) => f.instalment > 0 && !f.onTrack)
		.map((f) => ({
			id: f.id,
			name: f.name,
			accountId: f.accountId,
			amount: f.instalment,
			currency: ws.baseCurrency,
			dueDate: f.dueDate,
		}));
}

function shiftDay(day: string, by: number) {
	const d = new Date(`${day}T00:00:00Z`);
	d.setUTCDate(d.getUTCDate() + by);
	return d.toISOString().slice(0, 10);
}
