"use server";

import { auth } from "@/auth";
import { parentError } from "@/features/kuroji/lib/account-parent";
import { getOwnedWorkspace } from "@/lib/session";
import {
	accounts,
	and,
	db,
	eq,
	isNull,
	or,
	recurringTransactions,
	transactionEntries,
} from "@seikatsu/db";
import { revalidatePath } from "next/cache";

export async function getAccounts(workspaceId: string, opts?: { includeArchived?: boolean }) {
	const session = await auth();
	if (!session?.user?.id) throw new Error("Unauthorized");

	const ws = await getOwnedWorkspace(workspaceId);

	if (!ws) throw new Error("Forbidden");

	const filter = opts?.includeArchived
		? eq(accounts.workspaceId, workspaceId)
		: and(eq(accounts.workspaceId, workspaceId), isNull(accounts.archivedAt));
	return db.select().from(accounts).where(filter);
}

export async function createAccount(
	workspaceId: string,
	name: string,
	type: "ASSET" | "LIABILITY" | "INCOME" | "EXPENSE",
	parentId?: string,
	budget?: number,
	currency?: string,
) {
	const session = await auth();
	if (!session?.user?.id) throw new Error("Unauthorized");

	const workspace = await getOwnedWorkspace(workspaceId);
	if (!workspace) throw new Error("Forbidden");

	if (parentId) {
		const [parent] = await db
			.select({ workspaceId: accounts.workspaceId })
			.from(accounts)
			.where(eq(accounts.id, parentId))
			.limit(1);
		if (!parent || parent.workspaceId !== workspaceId) throw new Error("Parent account not found");
	}

	const [account] = await db
		.insert(accounts)
		.values({
			workspaceId,
			name,
			type,
			currency: currency ?? workspace.baseCurrency,
			parentId: parentId ?? null,
			budget: budget != null ? String(budget) : null,
		})
		.returning();

	revalidatePath("/kuroji");
	return account;
}

export async function updateAccount(
	accountId: string,
	data: {
		name: string;
		type: "ASSET" | "LIABILITY" | "INCOME" | "EXPENSE";
		parentId?: string | null;
		budget?: number | null;
		currency?: string;
	},
): Promise<{ error: string } | { success: true }> {
	const session = await auth();
	if (!session?.user?.id) return { error: "Unauthorized" };

	const [existing] = await db
		.select({ workspaceId: accounts.workspaceId })
		.from(accounts)
		.where(eq(accounts.id, accountId))
		.limit(1);

	if (!existing) return { error: "Account not found" };

	const ws = await getOwnedWorkspace(existing.workspaceId);

	if (!ws) return { error: "Forbidden" };

	if (data.parentId) {
		const tree = await db
			.select({ id: accounts.id, parentId: accounts.parentId })
			.from(accounts)
			.where(eq(accounts.workspaceId, ws.id));
		const error = parentError(accountId, data.parentId, tree);
		if (error) return { error };
	}

	await db
		.update(accounts)
		.set({
			name: data.name,
			type: data.type,
			parentId: data.parentId ?? null,
			budget: data.budget != null ? String(data.budget) : null,
			...(data.currency ? { currency: data.currency } : {}),
			updatedAt: new Date(),
		})
		.where(eq(accounts.id, accountId));

	revalidatePath("/kuroji");
	return { success: true };
}

export async function deleteAccount(
	accountId: string,
): Promise<{ error: string } | { success: true }> {
	const session = await auth();
	if (!session?.user?.id) return { error: "Unauthorized" };

	const [account] = await db
		.select({ workspaceId: accounts.workspaceId })
		.from(accounts)
		.where(eq(accounts.id, accountId))
		.limit(1);

	if (!account) return { error: "Account not found" };

	const ws = await getOwnedWorkspace(account.workspaceId);

	if (!ws) return { error: "Forbidden" };

	const [child] = await db
		.select({ id: accounts.id })
		.from(accounts)
		.where(eq(accounts.parentId, accountId))
		.limit(1);

	if (child) {
		return { error: "This account has sub-accounts. Move or delete them first." };
	}

	const entries = await db
		.select({ id: transactionEntries.id })
		.from(transactionEntries)
		.where(eq(transactionEntries.accountId, accountId))
		.limit(1);

	if (entries.length > 0) {
		return { error: "This account has transactions. Archive it instead to keep its history." };
	}

	const [recurring] = await db
		.select({ id: recurringTransactions.id })
		.from(recurringTransactions)
		.where(
			or(
				eq(recurringTransactions.fromAccountId, accountId),
				eq(recurringTransactions.toAccountId, accountId),
			),
		)
		.limit(1);

	if (recurring) {
		return { error: "This account is used by a recurring payment. Delete or change it first." };
	}

	await db.delete(accounts).where(eq(accounts.id, accountId));
	revalidatePath("/kuroji");
	return { success: true };
}

export async function archiveAccount(
	accountId: string,
): Promise<{ error: string } | { success: true }> {
	const session = await auth();
	if (!session?.user?.id) return { error: "Unauthorized" };

	const [account] = await db
		.select({ workspaceId: accounts.workspaceId })
		.from(accounts)
		.where(eq(accounts.id, accountId))
		.limit(1);

	if (!account) return { error: "Account not found" };

	const ws = await getOwnedWorkspace(account.workspaceId);

	if (!ws) return { error: "Forbidden" };

	await db.update(accounts).set({ archivedAt: new Date() }).where(eq(accounts.id, accountId));
	revalidatePath("/kuroji");
	revalidatePath("/kuroji/settings");
	return { success: true };
}

export async function unarchiveAccount(
	accountId: string,
): Promise<{ error: string } | { success: true }> {
	const session = await auth();
	if (!session?.user?.id) return { error: "Unauthorized" };

	const [account] = await db
		.select({ workspaceId: accounts.workspaceId })
		.from(accounts)
		.where(eq(accounts.id, accountId))
		.limit(1);

	if (!account) return { error: "Account not found" };

	const ws = await getOwnedWorkspace(account.workspaceId);

	if (!ws) return { error: "Forbidden" };

	await db.update(accounts).set({ archivedAt: null }).where(eq(accounts.id, accountId));
	revalidatePath("/kuroji");
	revalidatePath("/kuroji/settings");
	return { success: true };
}

export async function toggleAccountDashboardVisibility(
	accountId: string,
	hidden: boolean,
): Promise<{ error: string } | { success: true }> {
	const session = await auth();
	if (!session?.user?.id) return { error: "Unauthorized" };

	const [account] = await db
		.select({ workspaceId: accounts.workspaceId })
		.from(accounts)
		.where(eq(accounts.id, accountId))
		.limit(1);

	if (!account) return { error: "Account not found" };

	const ws = await getOwnedWorkspace(account.workspaceId);

	if (!ws) return { error: "Forbidden" };

	await db.update(accounts).set({ hiddenFromDashboard: hidden }).where(eq(accounts.id, accountId));
	revalidatePath("/kuroji");
	return { success: true };
}
