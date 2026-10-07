"use server";

import { auth } from "@/auth";
import { getCurrentWorkspace, getOwnedWorkspace, getSessionUserId } from "@/lib/session";
import { db, eq, workspaces } from "@seikatsu/db";
import { revalidatePath } from "next/cache";

export async function getWorkspace(userId: string) {
	if ((await getSessionUserId()) !== userId) throw new Error("Unauthorized");
	return getCurrentWorkspace();
}

export async function initializeWorkspace(userId: string) {
	const workspace = await getWorkspace(userId);
	if (!workspace) throw new Error("Unauthorized");
	return workspace;
}

export async function updateWorkspace(
	workspaceId: string,
	data: { name: string },
): Promise<{ error: string } | { success: true }> {
	const session = await auth();
	if (!session?.user?.id) return { error: "Unauthorized" };

	const ws = await getOwnedWorkspace(workspaceId);
	if (!ws) return { error: "Forbidden" };

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
