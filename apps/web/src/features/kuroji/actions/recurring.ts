"use server";

import { accounts, and, db, eq, recurringTransactions } from "@seikatsu/db";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { type Frequency, generateDueForWorkspace } from "@/features/kuroji/lib/recurring-runner";
import { getOwnedWorkspace } from "@/lib/session";
import { getUserToday } from "@/lib/timezone";

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

const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date");
const recurringSchema = z
	.object({
		workspaceId: z.uuid(),
		fromAccountId: z.uuid("Pick an account"),
		toAccountId: z.uuid("Pick an account"),
		amount: z.number().finite().positive("Amount must be more than zero").max(1e12),
		currency: z.string().regex(/^[A-Z]{3}$/, "Unknown currency"),
		description: z.string().max(500).optional(),
		frequency: z.enum(["daily", "weekly", "monthly", "yearly"]),
		startDate: isoDay,
		endDate: isoDay.optional(),
	})
	.refine((d) => d.fromAccountId !== d.toAccountId, "Pick two different accounts")
	.refine((d) => !d.endDate || d.endDate >= d.startDate, "The end comes before the start");

export async function createRecurringTransaction(
	input: z.input<typeof recurringSchema>,
): Promise<{ error: string } | { success: true }> {
	const session = await auth();
	if (!session?.user?.id) return { error: "Unauthorized" };
	const parsed = recurringSchema.safeParse(input);
	if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
	const data = parsed.data;

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
	await generateDueForWorkspace(ws, await getUserToday());

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
	// Resuming catches up on periods missed while paused. It can fetch exchange rates, so it
	// runs after the response; the dashboard reads fresh data on the next visit anyway.
	if (!rt.isActive) {
		const today = await getUserToday();
		after(() => generateDueForWorkspace(ws, today));
	}
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
