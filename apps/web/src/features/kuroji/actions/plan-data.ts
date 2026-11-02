// Read-side queries for the Plan tab. Not a "use server" module, so nothing here is
// callable from the client — import only from RSC pages or server actions.

import {
	accounts,
	and,
	db,
	eq,
	gte,
	isNull,
	kurojiBudgetMonths,
	kurojiFunds,
	recurringTransactions,
} from "@seikatsu/db";
import { addDays, format } from "date-fns";
import { auth } from "@/auth";
import { getBalances } from "@/features/kuroji/actions/balances";
import { displayBalance } from "@/features/kuroji/lib/balance";
import { parseLocal } from "@/features/kuroji/lib/dates";
import { getRates } from "@/features/kuroji/lib/exchange-rates";
import {
	allocateFunds,
	buildPlan,
	type FundView,
	monthBounds,
	monthProgress,
	occurrencesBetween,
	type PlanAccount,
	shiftMonth,
} from "@/features/kuroji/lib/plan";
import { getOwnedWorkspace } from "@/lib/session";
import { getUserToday } from "@/lib/timezone";

export type UpcomingItem = {
	id: string;
	date: string;
	description: string | null;
	/** Base currency. */
	amount: number;
	/** The category or account the money goes to (or, for income, comes from). */
	target: string;
	kind: "expense" | "income" | "transfer";
};

export type PlanData = Awaited<ReturnType<typeof getPlan>>;

/** Everything the Plan tab shows for one month, in base currency. */
export async function getPlan(workspaceId: string, month: string) {
	const session = await auth();
	if (!session?.user?.id) throw new Error("Unauthorized");
	const ws = await getOwnedWorkspace(workspaceId);
	if (!ws) throw new Error("Forbidden");

	const today = await getUserToday();
	const { from, to } = monthBounds(month);
	const progress = monthProgress(month, today);
	const prevMonthEnd = monthBounds(shiftMonth(month, -1)).to;

	const [all, balances, balancesAtStart, overrideRows, recurring, fundRows] = await Promise.all([
		db
			.select()
			.from(accounts)
			.where(and(eq(accounts.workspaceId, ws.id), isNull(accounts.archivedAt))),
		getBalances(ws.id, from, to),
		getBalances(ws.id, undefined, prevMonthEnd),
		db
			.select({ accountId: kurojiBudgetMonths.accountId, amount: kurojiBudgetMonths.amount })
			.from(kurojiBudgetMonths)
			.innerJoin(accounts, eq(accounts.id, kurojiBudgetMonths.accountId))
			.where(and(eq(accounts.workspaceId, ws.id), eq(kurojiBudgetMonths.month, from))),
		db
			.select()
			.from(recurringTransactions)
			.where(
				and(eq(recurringTransactions.workspaceId, ws.id), eq(recurringTransactions.isActive, true)),
			),
		db
			.select()
			.from(kurojiFunds)
			.where(and(eq(kurojiFunds.workspaceId, ws.id), gte(kurojiFunds.dueDate, from))),
	]);

	const byId = new Map(all.map((a) => [a.id, a]));
	const planAccounts: PlanAccount[] = all.map((a) => ({
		id: a.id,
		parentId: a.parentId,
		name: a.name,
		type: a.type,
		hidden: a.hiddenFromDashboard,
		budget: a.budget != null ? Number(a.budget) : null,
	}));

	// Recurring transactions still to come this month: tomorrow on in the current month, all
	// of a future one. Today's is created by the morning cron, so it's already in the ledger.
	const tomorrow = format(addDays(parseLocal(today), 1), "yyyy-MM-dd");
	const windowFrom = from > tomorrow ? from : tomorrow;
	const rates = await getRates(
		recurring.map((r) => r.currency),
		ws.baseCurrency,
		today,
	);
	const toBase = (amount: number, currency: string) => {
		const rate = rates.get(currency);
		return rate != null ? amount * rate : amount;
	};

	const upcoming: UpcomingItem[] = [];
	const upcomingByCategory = new Map<string, number>();
	const recurringCategories = new Set<string>();
	// A category's figures roll up into same-type parents, so its recurring money does too.
	const withAncestors = (id: string) => {
		const ids = [id];
		const type = byId.get(id)?.type;
		let p = byId.get(id)?.parentId ? byId.get(byId.get(id)?.parentId ?? "") : undefined;
		while (p && p.type === type) {
			ids.push(p.id);
			p = p.parentId ? byId.get(p.parentId) : undefined;
		}
		return ids;
	};

	for (const rec of recurring) {
		const toAcc = byId.get(rec.toAccountId);
		const fromAcc = byId.get(rec.fromAccountId);
		if (!toAcc || !fromAcc) continue;
		const category =
			toAcc.type === "EXPENSE" ? toAcc : fromAcc.type === "INCOME" ? fromAcc : undefined;
		if (category) for (const id of withAncestors(category.id)) recurringCategories.add(id);

		const dates = windowFrom <= to ? occurrencesBetween(rec, windowFrom, to) : [];
		if (dates.length === 0) continue;
		const amount = toBase(Number(rec.amount), rec.currency);
		for (const date of dates) {
			upcoming.push({
				id: `${rec.id}:${date}`,
				date,
				description: rec.description,
				amount,
				target: category?.name ?? toAcc.name,
				kind:
					toAcc.type === "EXPENSE" ? "expense" : fromAcc.type === "INCOME" ? "income" : "transfer",
			});
			if (category) {
				for (const id of withAncestors(category.id)) {
					upcomingByCategory.set(id, (upcomingByCategory.get(id) ?? 0) + amount);
				}
			}
		}
	}
	upcoming.sort((a, b) => a.date.localeCompare(b.date));

	const plan = buildPlan({
		accounts: planAccounts,
		balances: new Map(
			balances
				.filter((b) => b.type === "INCOME" || b.type === "EXPENSE")
				.map((b) => [b.accountId, Number(b.balance)]),
		),
		overrides: new Map(overrideRows.map((r) => [r.accountId, Number(r.amount)])),
		upcomingByCategory,
		recurringCategories,
		progress,
	});

	const assetBalance = (rows: typeof balances) =>
		new Map(
			rows
				.filter((b) => b.type === "ASSET")
				.map((b) => [b.accountId, displayBalance("ASSET", Number(b.balance))]),
		);
	const funds: (FundView & { accountName: string })[] = allocateFunds(
		fundRows.map((f) => ({
			id: f.id,
			name: f.name,
			accountId: f.accountId,
			target: Number(f.target),
			dueDate: f.dueDate,
		})),
		month,
		assetBalance(balances),
		assetBalance(balancesAtStart),
	).map((f) => ({ ...f, accountName: byId.get(f.accountId)?.name ?? "" }));

	const instalments = funds.reduce((s, f) => s + f.instalment, 0);

	return {
		month,
		today,
		progress,
		currency: ws.baseCurrency,
		...plan,
		upcoming,
		funds,
		totals: {
			...plan.totals,
			instalments,
			free: plan.totals.incomePlan - plan.totals.expensePlan - instalments,
		},
		/** For the fund form: where trip money can sit. */
		assetAccounts: all
			.filter((a) => a.type === "ASSET" && !a.hiddenFromDashboard)
			.map((a) => ({ id: a.id, name: a.name })),
		/** For "plan a category": every visible flow category. */
		categories: all
			.filter((a) => (a.type === "EXPENSE" || a.type === "INCOME") && !a.hiddenFromDashboard)
			.map((a) => ({
				id: a.id,
				name: a.name,
				type: a.type as "EXPENSE" | "INCOME",
				parentId: a.parentId,
			})),
	};
}

/** Average monthly spend per expense category over the three months before `month`. */
export async function getPlanSuggestions(workspaceId: string, month: string) {
	const from = monthBounds(shiftMonth(month, -3)).from;
	const to = monthBounds(shiftMonth(month, -1)).to;
	const balances = await getBalances(workspaceId, from, to);
	return balances
		.filter((b) => b.type === "EXPENSE" && !b.hidden && !b.parentId)
		.map((b) => ({
			accountId: b.accountId,
			name: b.name,
			average: Math.round(displayBalance("EXPENSE", Number(b.balance)) / 3),
		}))
		.filter((s) => s.average > 0)
		.sort((a, b) => b.average - a.average);
}
