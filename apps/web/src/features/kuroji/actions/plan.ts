"use server";

import { auth } from "@/auth";
import { getBalances } from "@/features/kuroji/actions/balances";
import { type AccountType, displayBalance } from "@/features/kuroji/lib/balance";
import { getExchangeRate } from "@/features/kuroji/lib/exchange-rates";
import {
	type FundView,
	type PlanAccount,
	allocateFunds,
	buildPlan,
	monthBounds,
	monthProgress,
	occurrencesBetween,
	shiftMonth,
} from "@/features/kuroji/lib/plan";
import { getOwnedWorkspace } from "@/lib/session";
import { getUserToday } from "@/lib/timezone";
import {
	accounts,
	and,
	db,
	eq,
	gte,
	inArray,
	isNull,
	kurojiBudgetMonths,
	kurojiFunds,
	recurringTransactions,
} from "@seikatsu/db";
import { addDays, format } from "date-fns";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { parseLocal } from "../lib/dates";

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
	const rates = new Map<string, number | null>();
	async function toBase(amount: number, currency: string) {
		if (currency === ws?.baseCurrency) return amount;
		if (!rates.has(currency)) {
			try {
				rates.set(currency, await getExchangeRate(currency, ws?.baseCurrency ?? currency, today));
			} catch {
				rates.set(currency, null);
			}
		}
		const rate = rates.get(currency);
		return rate != null ? amount * rate : amount;
	}

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
		const amount = await toBase(Number(rec.amount), rec.currency);
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
			.map((a) => ({ id: a.id, name: a.name, type: a.type as AccountType, parentId: a.parentId })),
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

const monthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
const amountSchema = z.number().finite().min(0).max(1e12);

async function ownedFlowAccount(accountId: string) {
	const [account] = await db
		.select({ workspaceId: accounts.workspaceId, type: accounts.type })
		.from(accounts)
		.where(eq(accounts.id, accountId))
		.limit(1);
	if (!account || (account.type !== "EXPENSE" && account.type !== "INCOME")) return null;
	return (await getOwnedWorkspace(account.workspaceId)) ? account : null;
}

const setPlanSchema = z.object({
	accountId: z.uuid(),
	month: monthSchema,
	/** null clears: the month falls back to the default, or the default is removed. */
	amount: amountSchema.nullable(),
	scope: z.enum(["month", "default"]),
});

/**
 * Plan a category. "month" sets this month only; "default" changes the amount from this month
 * on: it becomes the account's budget and this and later months' own amounts go.
 */
export async function setCategoryPlan(
	input: z.infer<typeof setPlanSchema>,
): Promise<{ error: string } | { success: true }> {
	const session = await auth();
	if (!session?.user?.id) return { error: "Unauthorized" };
	const parsed = setPlanSchema.safeParse(input);
	if (!parsed.success) return { error: "Invalid amount" };
	const { accountId, month, amount, scope } = parsed.data;
	if (!(await ownedFlowAccount(accountId))) return { error: "Category not found" };
	const first = `${month}-01`;

	if (scope === "month") {
		if (amount == null) {
			await db
				.delete(kurojiBudgetMonths)
				.where(
					and(eq(kurojiBudgetMonths.accountId, accountId), eq(kurojiBudgetMonths.month, first)),
				);
		} else {
			await db
				.insert(kurojiBudgetMonths)
				.values({ accountId, month: first, amount: String(amount) })
				.onConflictDoUpdate({
					target: [kurojiBudgetMonths.accountId, kurojiBudgetMonths.month],
					set: { amount: String(amount) },
				});
		}
	} else {
		await db.transaction(async (tx) => {
			await tx
				.update(accounts)
				.set({
					budget: amount != null && amount > 0 ? String(amount) : null,
					updatedAt: new Date(),
				})
				.where(eq(accounts.id, accountId));
			await tx
				.delete(kurojiBudgetMonths)
				.where(
					and(eq(kurojiBudgetMonths.accountId, accountId), gte(kurojiBudgetMonths.month, first)),
				);
		});
	}

	revalidatePath("/kuroji");
	return { success: true };
}

/** Adopt several defaults at once (the empty state's suggestions). */
export async function adoptPlanDefaults(
	workspaceId: string,
	items: { accountId: string; amount: number }[],
): Promise<{ error: string } | { success: true }> {
	const session = await auth();
	if (!session?.user?.id) return { error: "Unauthorized" };
	const ws = await getOwnedWorkspace(workspaceId);
	if (!ws) return { error: "Forbidden" };
	const parsed = z
		.array(z.object({ accountId: z.uuid(), amount: amountSchema.positive() }))
		.max(200)
		.safeParse(items);
	if (!parsed.success || parsed.data.length === 0) return { error: "Nothing to plan" };

	const ids = parsed.data.map((i) => i.accountId);
	const owned = await db
		.select({ id: accounts.id })
		.from(accounts)
		.where(
			and(
				inArray(accounts.id, ids),
				eq(accounts.workspaceId, ws.id),
				inArray(accounts.type, ["EXPENSE", "INCOME"]),
			),
		);
	if (owned.length !== new Set(ids).size) return { error: "Category not found" };

	await db.transaction(async (tx) => {
		for (const { accountId, amount } of parsed.data) {
			await tx
				.update(accounts)
				.set({ budget: String(amount), updatedAt: new Date() })
				.where(eq(accounts.id, accountId));
		}
	});
	revalidatePath("/kuroji");
	return { success: true };
}

const fundSchema = z.object({
	name: z.string().trim().min(1).max(80),
	target: amountSchema.positive(),
	dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
	accountId: z.uuid(),
});

async function ownedAssetAccount(workspaceId: string, accountId: string) {
	const [account] = await db
		.select({ id: accounts.id })
		.from(accounts)
		.where(
			and(
				eq(accounts.id, accountId),
				eq(accounts.workspaceId, workspaceId),
				eq(accounts.type, "ASSET"),
			),
		)
		.limit(1);
	return !!account;
}

export async function createFund(
	workspaceId: string,
	input: z.infer<typeof fundSchema>,
): Promise<{ error: string } | { success: true }> {
	const session = await auth();
	if (!session?.user?.id) return { error: "Unauthorized" };
	const ws = await getOwnedWorkspace(workspaceId);
	if (!ws) return { error: "Forbidden" };
	const parsed = fundSchema.safeParse(input);
	if (!parsed.success) return { error: "Check the name, amount and date" };
	if (!(await ownedAssetAccount(ws.id, parsed.data.accountId))) {
		return { error: "Account not found" };
	}

	await db.insert(kurojiFunds).values({
		workspaceId: ws.id,
		...parsed.data,
		target: String(parsed.data.target),
	});
	revalidatePath("/kuroji");
	return { success: true };
}

async function ownedFund(fundId: string) {
	const [fund] = await db
		.select({ workspaceId: kurojiFunds.workspaceId })
		.from(kurojiFunds)
		.where(eq(kurojiFunds.id, fundId))
		.limit(1);
	if (!fund) return null;
	return getOwnedWorkspace(fund.workspaceId);
}

export async function updateFund(
	fundId: string,
	input: z.infer<typeof fundSchema>,
): Promise<{ error: string } | { success: true }> {
	const session = await auth();
	if (!session?.user?.id) return { error: "Unauthorized" };
	const ws = await ownedFund(fundId);
	if (!ws) return { error: "Fund not found" };
	const parsed = fundSchema.safeParse(input);
	if (!parsed.success) return { error: "Check the name, amount and date" };
	if (!(await ownedAssetAccount(ws.id, parsed.data.accountId))) {
		return { error: "Account not found" };
	}

	await db
		.update(kurojiFunds)
		.set({ ...parsed.data, target: String(parsed.data.target) })
		.where(eq(kurojiFunds.id, fundId));
	revalidatePath("/kuroji");
	return { success: true };
}

/** The money stays in its account; only the goal goes. */
export async function deleteFund(fundId: string): Promise<{ error: string } | { success: true }> {
	const session = await auth();
	if (!session?.user?.id) return { error: "Unauthorized" };
	if (!(await ownedFund(fundId))) return { error: "Fund not found" };

	await db.delete(kurojiFunds).where(eq(kurojiFunds.id, fundId));
	revalidatePath("/kuroji");
	return { success: true };
}
