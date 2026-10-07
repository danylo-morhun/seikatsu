"use server";

import { auth } from "@/auth";
import { type Frequency, generateDueForWorkspace } from "@/features/kuroji/lib/recurring-runner";
import { getOwnedWorkspace } from "@/lib/session";
import { accounts, and, db, eq, or, recurringTransactions } from "@seikatsu/db";
import { revalidatePath } from "next/cache";

export type { Frequency };

export type RecurringTransaction = {
	id: string;
	fromAccountId: string;
	fromAccountName: string;
	toAccountId: string;
	toAccountName: string;
	amount: string;
	currency: string;
	description: string | null;
	frequency: Frequency;
	nextDate: string;
	endDate: string | null;
	isActive: boolean;
};

export async function getRecurringTransactions(
	workspaceId: string,
): Promise<RecurringTransaction[]> {
	const session = await auth();
	if (!session?.user?.id) throw new Error("Unauthorized");

	const ws = await getOwnedWorkspace(workspaceId);

	if (!ws) throw new Error("Forbidden");

	const rows = await db.query.recurringTransactions.findMany({
		where: eq(recurringTransactions.workspaceId, workspaceId),
		with: {
			fromAccount: true,
			toAccount: true,
		},
		orderBy: (rt, { desc }) => [desc(rt.createdAt)],
	});

	return rows.map((r) => ({
		id: r.id,
		fromAccountId: r.fromAccountId,
		fromAccountName: r.fromAccount?.name ?? "—",
		toAccountId: r.toAccountId,
		toAccountName: r.toAccount?.name ?? "—",
		amount: r.amount,
		currency: r.currency,
		description: r.description,
		frequency: r.frequency as Frequency,
		nextDate: r.nextDate,
		endDate: r.endDate,
		isActive: r.isActive,
	}));
}

export async function createRecurringTransaction(data: {
	workspaceId: string;
	fromAccountId: string;
	toAccountId: string;
	amount: number;
	currency: string;
	description?: string;
	frequency: Frequency;
	startDate: string;
	endDate?: string;
}): Promise<{ error: string } | { success: true }> {
	const session = await auth();
	if (!session?.user?.id) return { error: "Unauthorized" };

	const [ws, fromRows, toRows] = await Promise.all([
		getOwnedWorkspace(data.workspaceId),
		db
			.select({ id: accounts.id })
			.from(accounts)
			.where(and(eq(accounts.id, data.fromAccountId), eq(accounts.workspaceId, data.workspaceId)))
			.limit(1),
		db
			.select({ id: accounts.id })
			.from(accounts)
			.where(and(eq(accounts.id, data.toAccountId), eq(accounts.workspaceId, data.workspaceId)))
			.limit(1),
	]);

	if (!ws) return { error: "Forbidden" };
	if (!fromRows[0] || !toRows[0]) return { error: "Account not found" };

	await db.insert(recurringTransactions).values({
		workspaceId: data.workspaceId,
		fromAccountId: data.fromAccountId,
		toAccountId: data.toAccountId,
		amount: String(data.amount),
		currency: data.currency,
		description: data.description ?? null,
		frequency: data.frequency,
		nextDate: data.startDate,
		endDate: data.endDate ?? null,
		isActive: true,
	});
	// A start date in the past (or today) materializes immediately.
	await generateDueForWorkspace(ws);

	revalidatePath("/kuroji");
	return { success: true };
}

export async function toggleRecurring(id: string): Promise<{ error: string } | { success: true }> {
	const session = await auth();
	if (!session?.user?.id) return { error: "Unauthorized" };

	const [rt] = await db
		.select()
		.from(recurringTransactions)
		.where(eq(recurringTransactions.id, id))
		.limit(1);
	if (!rt) return { error: "Not found" };

	const ws = await getOwnedWorkspace(rt.workspaceId);
	if (!ws) return { error: "Forbidden" };

	await db
		.update(recurringTransactions)
		.set({ isActive: !rt.isActive, updatedAt: new Date() })
		.where(eq(recurringTransactions.id, id));
	// Resuming catches up on periods missed while paused, as the page used to on next visit.
	if (!rt.isActive) await generateDueForWorkspace(ws);
	revalidatePath("/kuroji");
	return { success: true };
}

export async function deleteRecurringTransaction(
	id: string,
): Promise<{ error: string } | { success: true }> {
	const session = await auth();
	if (!session?.user?.id) return { error: "Unauthorized" };

	const [rt] = await db
		.select({ workspaceId: recurringTransactions.workspaceId })
		.from(recurringTransactions)
		.where(eq(recurringTransactions.id, id))
		.limit(1);
	if (!rt) return { error: "Not found" };

	const ws = await getOwnedWorkspace(rt.workspaceId);
	if (!ws) return { error: "Forbidden" };

	await db.delete(recurringTransactions).where(eq(recurringTransactions.id, id));
	revalidatePath("/kuroji");
	return { success: true };
}

export async function generateDueRecurring(workspaceId: string): Promise<{ generated: number }> {
	const ws = await getOwnedWorkspace(workspaceId);
	if (!ws) return { generated: 0 };

	const result = await generateDueForWorkspace(ws);
	if (result.generated > 0) revalidatePath("/kuroji");
	return result;
}
