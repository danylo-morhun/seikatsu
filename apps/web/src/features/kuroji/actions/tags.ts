"use server";

import { getOwnedWorkspace } from "@/lib/session";
import { db, tags } from "@seikatsu/db";
import { revalidatePath } from "next/cache";

export type Tag = { id: string; name: string; color: string | null };

export async function createTag(
	workspaceId: string,
	name: string,
	color?: string,
): Promise<{ error: string } | { success: true; tag: Tag }> {
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
