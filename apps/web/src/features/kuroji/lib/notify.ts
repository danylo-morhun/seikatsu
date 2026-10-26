import { type AccountType, accountScope } from "@/features/kuroji/lib/balance";
import { formatCurrency } from "@/features/kuroji/lib/format";
import type { Notifier } from "@/features/pwa/lib/notifiers";
import { sendNew, sendOnce } from "@/features/pwa/lib/push";
import { isTimeDue } from "@/features/pwa/lib/schedule";
import {
	accounts,
	and,
	db,
	eq,
	gte,
	inArray,
	isNull,
	lte,
	recurringTransactions,
	sum,
	transactionEntries,
	transactions,
	workspaces,
} from "@seikatsu/db";

/** Budget alerts go out while awake only, whenever the cron notices the crossing. */
const AWAKE_FROM = 8 * 60;
const AWAKE_UNTIL = 22 * 60;
const BUDGET_MARKS = [100, 80] as const;

function addDays(day: string, n: number): string {
	return new Date(Date.parse(`${day}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
}

async function baseCurrencyOf(workspaceId: string): Promise<string> {
	const [ws] = await db
		.select({ baseCurrency: workspaces.baseCurrency })
		.from(workspaces)
		.where(eq(workspaces.id, workspaceId));
	return ws?.baseCurrency ?? "USD";
}

/**
 * Morning: the recurring transactions the overnight cron posted for today (matched by
 * description and both accounts), so a subscription renewal never slips by unseen.
 */
export const notifyKurojiRecurring: Notifier = async ({ workspaceId, prefs, clock }) => {
	if (!prefs.kurojiRecurring || !isTimeDue(prefs.morningTime, clock)) return 0;

	const recurring = await db
		.select()
		.from(recurringTransactions)
		.where(
			and(
				eq(recurringTransactions.workspaceId, workspaceId),
				eq(recurringTransactions.isActive, true),
			),
		);
	if (recurring.length === 0) return 0;

	const entries = await db
		.select({
			transactionId: transactions.id,
			description: transactions.description,
			accountId: transactionEntries.accountId,
			amount: transactionEntries.amount,
		})
		.from(transactions)
		.innerJoin(transactionEntries, eq(transactionEntries.transactionId, transactions.id))
		.where(and(eq(transactions.workspaceId, workspaceId), eq(transactions.date, clock.day)));

	const byTxn = new Map<string, typeof entries>();
	for (const e of entries) {
		const list = byTxn.get(e.transactionId);
		if (list) list.push(e);
		else byTxn.set(e.transactionId, [e]);
	}
	const posted = recurring.filter((rt) =>
		[...byTxn.values()].some(
			(legs) =>
				legs.length === 2 &&
				(legs[0].description ?? null) === (rt.description ?? null) &&
				legs.some((l) => l.accountId === rt.fromAccountId && Number(l.amount) < 0) &&
				legs.some((l) => l.accountId === rt.toAccountId && Number(l.amount) > 0),
		),
	);
	if (posted.length === 0) return 0;

	const sent = await sendOnce(workspaceId, `kuroji:recurring:${clock.day}`, {
		title: posted.length === 1 ? "Recurring posted" : `${posted.length} recurring posted`,
		body: posted
			.map(
				(rt) =>
					`${rt.description ?? "Recurring"} ${formatCurrency(Number(rt.amount), rt.currency)}`,
			)
			.join(" · "),
		url: "/kuroji?tab=transactions",
		tag: "kuroji-recurring",
	});
	return sent ? 1 : 0;
};

/** A category with a monthly budget passing 80% and 100% of it, once per mark per month. */
export const notifyKurojiBudget: Notifier = async ({ workspaceId, prefs, clock }) => {
	if (!prefs.kurojiBudget || clock.minutes < AWAKE_FROM || clock.minutes >= AWAKE_UNTIL) return 0;

	const all = await db
		.select({
			accountId: accounts.id,
			parentId: accounts.parentId,
			name: accounts.name,
			type: accounts.type,
			budget: accounts.budget,
			hidden: accounts.hiddenFromDashboard,
		})
		.from(accounts)
		.where(and(eq(accounts.workspaceId, workspaceId), isNull(accounts.archivedAt)));
	const budgeted = all.filter((a) => a.type === "EXPENSE" && Number(a.budget) > 0);
	if (budgeted.length === 0) return 0;

	const month = clock.day.slice(0, 7);
	const scopes = budgeted.map((a) => accountScope(a.accountId, a.type as AccountType, all));
	const spentRows = await db
		.select({ accountId: transactionEntries.accountId, total: sum(transactionEntries.baseAmount) })
		.from(transactionEntries)
		.innerJoin(transactions, eq(transactions.id, transactionEntries.transactionId))
		.where(
			and(
				inArray(transactionEntries.accountId, [...new Set(scopes.flat())]),
				gte(transactions.date, `${month}-01`),
				lte(transactions.date, clock.day),
			),
		)
		.groupBy(transactionEntries.accountId);
	const spentBy = new Map(spentRows.map((r) => [r.accountId, Number(r.total ?? 0)]));
	const currency = await baseCurrencyOf(workspaceId);

	const crossed = budgeted.flatMap((a, i) => {
		const budget = Number(a.budget);
		const spent = scopes[i].reduce((s, id) => s + (spentBy.get(id) ?? 0), 0);
		const pct = (spent / budget) * 100;
		const mark = BUDGET_MARKS.find((m) => pct >= m);
		if (!mark) return [];
		return [
			{
				key: `kuroji:budget:${a.accountId}:${month}:${mark}`,
				mark,
				line: `${a.name} ${Math.round(pct)}% · ${formatCurrency(spent, currency)} of ${formatCurrency(budget, currency)}`,
			},
		];
	});

	const sent = await sendNew(workspaceId, crossed, (fresh) => ({
		title: fresh.some((c) => c.mark === 100) ? "Over budget" : "Budget nearly used",
		body: fresh.map((c) => c.line).join(" · "),
		url: "/kuroji?tab=accounts",
		tag: "kuroji-budget",
	}));
	return sent ? 1 : 0;
};

/** Monday morning: last week's income, spending and what's left over. */
export const notifyKurojiWeekly: Notifier = async ({ workspaceId, prefs, clock }) => {
	if (!prefs.kurojiWeekly || clock.weekday !== 1 || !isTimeDue(prefs.morningTime, clock)) return 0;

	const from = addDays(clock.day, -7);
	const to = addDays(clock.day, -1);
	const rows = await db
		.select({ type: accounts.type, total: sum(transactionEntries.baseAmount) })
		.from(transactionEntries)
		.innerJoin(transactions, eq(transactions.id, transactionEntries.transactionId))
		.innerJoin(accounts, eq(accounts.id, transactionEntries.accountId))
		.where(
			and(
				eq(transactions.workspaceId, workspaceId),
				inArray(accounts.type, ["INCOME", "EXPENSE"]),
				gte(transactions.date, from),
				lte(transactions.date, to),
			),
		)
		.groupBy(accounts.type);
	// Income is credit-normal: its entries are negative.
	const income = -Number(rows.find((r) => r.type === "INCOME")?.total ?? 0);
	const spent = Number(rows.find((r) => r.type === "EXPENSE")?.total ?? 0);
	if (income === 0 && spent === 0) return 0;

	const currency = await baseCurrencyOf(workspaceId);
	const sent = await sendOnce(workspaceId, `kuroji:weekly:${clock.day}`, {
		title: "Last week",
		body: `Spent ${formatCurrency(spent, currency)} · Earned ${formatCurrency(income, currency)} · Net ${formatCurrency(income - spent, currency)}`,
		url: "/kuroji",
		tag: "kuroji-weekly",
	});
	return sent ? 1 : 0;
};
