"use server";

import { auth } from "@/auth";
import { getOwnedWorkspace } from "@/lib/session";
import { db, eq, tags } from "@seikatsu/db";
import { revalidatePath } from "next/cache";

export type Tag = { id: string; name: string; color: string | null };

export async function getTags(workspaceId: string): Promise<Tag[]> {
	const session = await auth();
	if (!session?.user?.id) throw new Error("Unauthorized");

	const ws = await getOwnedWorkspace(workspaceId);

	if (!ws) throw new Error("Forbidden");

	return db
		.select({ id: tags.id, name: tags.name, color: tags.color })
		.from(tags)
		.where(eq(tags.workspaceId, workspaceId));
}

export async function createTag(
	workspaceId: string,
	name: string,
	color?: string,
): Promise<{ error: string } | { success: true; tag: Tag }> {
	const session = await auth();
	if (!session?.user?.id) return { error: "Unauthorized" };

	const ws = await getOwnedWorkspace(workspaceId);

	if (!ws) return { error: "Forbidden" };

	try {
		const [tag] = await db
			.insert(tags)
			.values({ workspaceId, name: name.trim(), color: color ?? null })
			.returning({ id: tags.id, name: tags.name, color: tags.color });
		revalidatePath("/kuroji");
		return { success: true, tag };
	} catch {
		return { error: "Tag name already exists" };
	}
}
