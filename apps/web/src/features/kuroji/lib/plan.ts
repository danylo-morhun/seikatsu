import { type AccountType, displayBalance } from "@/features/kuroji/lib/balance";
import { parseLocal } from "@/features/kuroji/lib/dates";
import { type Frequency, advanceDate } from "@/features/kuroji/lib/recurring-dates";
import { differenceInCalendarMonths, endOfMonth, format } from "date-fns";

/** "2026-11" → its first and last day and length. */
export function monthBounds(month: string) {
	const start = parseLocal(`${month}-01`);
	return {
		from: `${month}-01`,
		to: format(endOfMonth(start), "yyyy-MM-dd"),
		days: endOfMonth(start).getDate(),
	};
}

export function shiftMonth(month: string, by: number): string {
	const [y, m] = month.split("-").map(Number);
	const d = new Date(y, m - 1 + by, 1);
	return format(d, "yyyy-MM");
}

/**
 * Where the month stands: days gone including today (0 for a future month, all for a past one)
 * and the share of the month that should be spent by now.
 */
export function monthProgress(month: string, today: string) {
	const { days } = monthBounds(month);
	const current = today.slice(0, 7);
	const elapsed = month < current ? days : month > current ? 0 : Number(today.slice(8, 10));
	return { elapsed, days, share: elapsed / days };
}

/** Dates a recurring transaction lands on within [from, to]. */
export function occurrencesBetween(
	rec: { nextDate: string; endDate: string | null; frequency: Frequency },
	from: string,
	to: string,
): string[] {
	const out: string[] = [];
	let d = rec.nextDate;
	while (d <= to && (!rec.endDate || d <= rec.endDate)) {
		if (d >= from) out.push(d);
		d = advanceDate(d, rec.frequency);
	}
	return out;
}

/** Round up to 5, so an instalment reads like money people transfer. */
export function ceilTo5(n: number) {
	return Math.ceil(n / 5) * 5;
}

export type PlanAccount = {
	id: string;
	parentId: string | null;
	name: string;
	type: AccountType;
	hidden: boolean;
	/** Default monthly plan (the account's `budget`), base currency. */
	budget: number | null;
};

export type PlanRow = {
	accountId: string;
	name: string;
	plan: number;
	/** The month has its own amount instead of the default. */
	overridden: boolean;
	/** The amount every month gets unless it has its own. */
	defaultPlan: number;
	/** Spent (expense) or received (income) in the month, base currency. */
	actual: number;
	/** Recurring transactions into this category still due this month. */
	upcoming: number;
	fixed: boolean;
	/** Projected month-end total; null when nothing can be said yet. */
	forecast: number | null;
};

export type UnplannedRow = { accountId: string; name: string; actual: number };

type BuildInput = {
	accounts: PlanAccount[];
	/** Rolled-up ledger balance of each INCOME/EXPENSE account over the month (getBalances). */
	balances: Map<string, number>;
	overrides: Map<string, number>;
	/** Category id → amount of recurring transactions still due this month. */
	upcomingByCategory: Map<string, number>;
	/** Categories some active recurring transaction feeds. */
	recurringCategories: Set<string>;
	progress: { elapsed: number; days: number };
};

/**
 * The month's plan rows. A category counts once: when a parent and its child both have a plan,
 * only the parent goes into totals (its actual already includes the child's).
 */
export function buildPlan({
	accounts,
	balances,
	overrides,
	upcomingByCategory,
	recurringCategories,
	progress,
}: BuildInput) {
	const visible = accounts.filter((a) => !a.hidden);
	const byId = new Map(visible.map((a) => [a.id, a]));
	const planOf = (a: PlanAccount) => overrides.get(a.id) ?? a.budget;
	const isPlanned = (a: PlanAccount) => (planOf(a) ?? 0) > 0;

	// A planned account with a planned ancestor of its type is already inside that ancestor.
	function plannedAncestor(a: PlanAccount): boolean {
		let p = a.parentId ? byId.get(a.parentId) : undefined;
		while (p && p.type === a.type) {
			if (isPlanned(p)) return true;
			p = p.parentId ? byId.get(p.parentId) : undefined;
		}
		return false;
	}

	const row = (a: PlanAccount): PlanRow => {
		const actual = displayBalance(a.type, balances.get(a.id) ?? 0);
		const upcoming = upcomingByCategory.get(a.id) ?? 0;
		const fixed = recurringCategories.has(a.id);
		return {
			accountId: a.id,
			name: a.name,
			plan: planOf(a) ?? 0,
			overridden: overrides.has(a.id),
			defaultPlan: a.budget ?? 0,
			actual,
			upcoming,
			fixed,
			forecast: forecastOf({ actual, upcoming, fixed, ...progress }),
		};
	};

	// Biggest plans first: they decide the month.
	const planned = (type: AccountType) =>
		visible
			.filter((a) => a.type === type && isPlanned(a))
			.map((a) => ({ row: row(a), counted: !plannedAncestor(a) }))
			.sort((x, y) => y.row.plan - x.row.plan);

	const expense = planned("EXPENSE");
	const income = planned("INCOME");

	// Spending outside every plan: each top-level expense category minus its planned parts.
	const countedExpense = new Set(expense.filter((e) => e.counted).map((e) => e.row.accountId));
	const unplanned: UnplannedRow[] = visible
		.filter(
			(a) =>
				a.type === "EXPENSE" &&
				!isPlanned(a) &&
				!plannedAncestor(a) &&
				(!a.parentId || byId.get(a.parentId)?.type !== "EXPENSE"),
		)
		.map((a) => {
			const inside = visible.filter((c) => countedExpense.has(c.id) && descendsFrom(c, a.id, byId));
			const actual =
				displayBalance("EXPENSE", balances.get(a.id) ?? 0) -
				inside.reduce((s, c) => s + displayBalance("EXPENSE", balances.get(c.id) ?? 0), 0);
			return { accountId: a.id, name: a.name, actual };
		})
		.filter((u) => Math.abs(u.actual) >= 0.005)
		.sort((a, b) => b.actual - a.actual);

	const sum = (rows: { row: PlanRow; counted: boolean }[], key: "plan" | "actual") =>
		rows.filter((r) => r.counted).reduce((s, r) => s + r.row[key], 0);

	return {
		expense: expense.map((e) => e.row),
		income: income.map((e) => e.row),
		unplanned,
		totals: {
			incomePlan: sum(income, "plan"),
			incomeActual: sum(income, "actual"),
			expensePlan: sum(expense, "plan"),
			expenseActual: sum(expense, "actual") + unplanned.reduce((s, u) => s + u.actual, 0),
		},
	};
}

function descendsFrom(a: PlanAccount, ancestorId: string, byId: Map<string, PlanAccount>) {
	let p = a.parentId ? byId.get(a.parentId) : undefined;
	while (p) {
		if (p.id === ancestorId) return true;
		p = p.parentId ? byId.get(p.parentId) : undefined;
	}
	return false;
}

/**
 * Month-end projection. Fixed categories (fed by recurring transactions) end at what's spent plus
 * what's still due. Variable ones continue at their pace so far — only once a week of data exists.
 */
export function forecastOf({
	actual,
	upcoming,
	fixed,
	elapsed,
	days,
}: {
	actual: number;
	upcoming: number;
	fixed: boolean;
	elapsed: number;
	days: number;
}): number | null {
	if (fixed) return actual + upcoming;
	if (elapsed >= days) return actual;
	if (elapsed < 7) return null;
	return actual + (actual / elapsed) * (days - elapsed) + upcoming;
}

export type FundInput = {
	id: string;
	name: string;
	accountId: string;
	target: number;
	dueDate: string;
};

export type FundView = FundInput & {
	/** Part of the account balance that belongs to this fund now. */
	filled: number;
	/** Planned transfer this month; 0 once the target is covered or the deadline has passed. */
	instalment: number;
	/** The account got at least its funds' instalments this month. */
	onTrack: boolean;
};

/**
 * Fills funds from their account's balance, earliest deadline first (as Hoshii fills its plan).
 * The instalment is fixed from the balance at the start of the month, so paying it doesn't
 * shrink it; whether it's paid is the account's net inflow this month.
 */
export function allocateFunds(
	funds: FundInput[],
	month: string,
	balanceNow: Map<string, number>,
	balanceAtStart: Map<string, number>,
): FundView[] {
	const sorted = [...funds].sort((a, b) => a.dueDate.localeCompare(b.dueDate));
	const leftNow = new Map(balanceNow);
	const leftAtStart = new Map(balanceAtStart);
	const views = sorted.map((f) => {
		const take = (pool: Map<string, number>) => {
			const have = Math.max(0, pool.get(f.accountId) ?? 0);
			const got = Math.min(have, f.target);
			pool.set(f.accountId, have - got);
			return got;
		};
		const filled = take(leftNow);
		const startFilled = take(leftAtStart);
		const monthsLeft =
			differenceInCalendarMonths(parseLocal(f.dueDate), parseLocal(`${month}-01`)) + 1;
		const instalment =
			monthsLeft > 0 && startFilled < f.target ? ceilTo5((f.target - startFilled) / monthsLeft) : 0;
		return { ...f, filled, instalment, onTrack: true };
	});

	const dueByAccount = new Map<string, number>();
	for (const v of views) {
		dueByAccount.set(v.accountId, (dueByAccount.get(v.accountId) ?? 0) + v.instalment);
	}
	return views.map((v) => {
		const inflow = (balanceNow.get(v.accountId) ?? 0) - (balanceAtStart.get(v.accountId) ?? 0);
		const due = dueByAccount.get(v.accountId) ?? 0;
		return { ...v, onTrack: v.instalment === 0 || inflow + 0.005 >= due };
	});
}
