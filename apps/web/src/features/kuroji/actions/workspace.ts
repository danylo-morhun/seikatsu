"use server";

import { auth } from "@/auth";
import { accounts, db, eq, workspaces } from "@seikatsu/db";
import { revalidatePath } from "next/cache";

export async function getWorkspace(userId: string) {
	const session = await auth();
	if (!session?.user?.id || session.user.id !== userId) throw new Error("Unauthorized");

	const [workspace] = await db
		.select()
		.from(workspaces)
		.where(eq(workspaces.userId, userId))
		.limit(1);
	return workspace ?? null;
}

export async function initializeWorkspace(userId: string) {
	const session = await auth();
	if (!session?.user?.id || session.user.id !== userId) throw new Error("Unauthorized");

	const [inserted] = await db
		.insert(workspaces)
		.values({ userId, name: "Kuroji", baseCurrency: "PLN" })
		.onConflictDoNothing()
		.returning();

	if (inserted) {
		await db.insert(accounts).values([
			{ workspaceId: inserted.id, name: "Wallet", type: "ASSET", currency: "PLN" },
			{ workspaceId: inserted.id, name: "Bank Account", type: "ASSET", currency: "PLN" },
			{ workspaceId: inserted.id, name: "Savings", type: "ASSET", currency: "PLN" },
			{ workspaceId: inserted.id, name: "Salary", type: "INCOME", currency: "PLN" },
			{ workspaceId: inserted.id, name: "Groceries", type: "EXPENSE", currency: "PLN" },
			{ workspaceId: inserted.id, name: "Transport", type: "EXPENSE", currency: "PLN" },
			{ workspaceId: inserted.id, name: "Dining", type: "EXPENSE", currency: "PLN" },
			{ workspaceId: inserted.id, name: "Utilities", type: "EXPENSE", currency: "PLN" },
			{ workspaceId: inserted.id, name: "Entertainment", type: "EXPENSE", currency: "PLN" },
		]);
		return inserted;
	}

	const [existing] = await db
		.select()
		.from(workspaces)
		.where(eq(workspaces.userId, userId))
		.limit(1);
	return existing;
}

export async function updateWorkspace(
	workspaceId: string,
	data: { name: string },
): Promise<{ error: string } | { success: true }> {
	const session = await auth();
	if (!session?.user?.id) return { error: "Unauthorized" };

	const [ws] = await db.select().from(workspaces).where(eq(workspaces.id, workspaceId)).limit(1);
	if (!ws || ws.userId !== session.user.id) return { error: "Forbidden" };

	const name = data.name.trim();
	if (!name) return { error: "Name is required" };

	await db
		.update(workspaces)
		.set({ name, updatedAt: new Date() })
		.where(eq(workspaces.id, workspaceId));

	revalidatePath("/kuroji");
	revalidatePath("/kuroji/settings");
	return { success: true };
}
