// Request-scoped session + workspace lookups. Not a "use server" module.
// `cache()` memoizes per server request, so layouts, pages and the data functions they
// call share one auth() decode and one workspace query instead of repeating them.

import { auth } from "@/auth";
import { accounts, db, eq, workspaces } from "@seikatsu/db";
import { cache } from "react";

export type Workspace = typeof workspaces.$inferSelect;

export const getSessionUserId = cache(async (): Promise<string | null> => {
	const session = await auth();
	return session?.user?.id ?? null;
});

/** The signed-in user's workspace (one per user), created with starter accounts on first use. */
export const getCurrentWorkspace = cache(async (): Promise<Workspace | null> => {
	const userId = await getSessionUserId();
	if (!userId) return null;

	const [existing] = await db
		.select()
		.from(workspaces)
		.where(eq(workspaces.userId, userId))
		.limit(1);
	return existing ?? createWorkspace(userId);
});

/** Returns the workspace if it belongs to the current user, else null. No extra query. */
export async function getOwnedWorkspace(workspaceId: string): Promise<Workspace | null> {
	const workspace = await getCurrentWorkspace();
	return workspace && workspace.id === workspaceId ? workspace : null;
}

async function createWorkspace(userId: string): Promise<Workspace> {
	// Unique index on userId: a concurrent first visit loses the insert and re-reads.
	const [inserted] = await db
		.insert(workspaces)
		.values({ userId, name: "Kuroji", baseCurrency: "PLN" })
		.onConflictDoNothing()
		.returning();

	if (!inserted) {
		const [existing] = await db
			.select()
			.from(workspaces)
			.where(eq(workspaces.userId, userId))
			.limit(1);
		return existing;
	}

	await db.insert(accounts).values(
		(
			[
				["Wallet", "ASSET"],
				["Bank Account", "ASSET"],
				["Savings", "ASSET"],
				["Salary", "INCOME"],
				["Groceries", "EXPENSE"],
				["Transport", "EXPENSE"],
				["Dining", "EXPENSE"],
				["Utilities", "EXPENSE"],
				["Entertainment", "EXPENSE"],
			] as const
		).map(([name, type]) => ({ workspaceId: inserted.id, name, type, currency: "PLN" })),
	);
	return inserted;
}
