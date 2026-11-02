"use server";

import { accounts, and, db, eq, gte, inArray, kurojiBudgetMonths, kurojiFunds } from "@seikatsu/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import { getOwnedWorkspace } from "@/lib/session";

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
