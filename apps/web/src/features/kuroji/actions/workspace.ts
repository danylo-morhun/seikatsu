"use server";

import { getOwnedWorkspace } from "@/lib/session";
import { db, eq, workspaces } from "@seikatsu/db";
import { revalidatePath } from "next/cache";

export async function updateWorkspace(
	workspaceId: string,
	data: { name: string },
): Promise<{ error: string } | { success: true }> {
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
