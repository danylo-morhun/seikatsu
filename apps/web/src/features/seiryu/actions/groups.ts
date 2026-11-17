"use server";

import { asc, db, eq, seiryuGroups } from "@seikatsu/db";
import { revalidatePath } from "next/cache";
import { getOwnedGroup, isOwnedProject, requireWorkspace } from "@/features/seiryu/actions/guard";
import {
	createGroupSchema,
	deleteGroupSchema,
	updateGroupSchema,
} from "@/features/seiryu/lib/seiryu-schemas";
import { generateKeyBetween } from "@/lib/position";

/** One project's groups, in their order. */
export async function getGroups(projectId: string) {
	const workspace = await requireWorkspace();
	if (!(await isOwnedProject(projectId, workspace.id))) throw new Error("Forbidden");

	return db
		.select({ id: seiryuGroups.id, name: seiryuGroups.name, position: seiryuGroups.position })
		.from(seiryuGroups)
		.where(eq(seiryuGroups.projectId, projectId))
		.orderBy(asc(seiryuGroups.position));
}

export async function createGroup(
	input: unknown,
): Promise<{ error: string } | { success: true; data: { id: string; position: string } }> {
	const workspace = await requireWorkspace();

	const parsed = createGroupSchema.safeParse(input);
	if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

	const { id, projectId, name } = parsed.data;
	if (!(await isOwnedProject(projectId, workspace.id))) return { error: "Project not found" };

	const existing = await getGroups(projectId);
	const same = existing.find((g) => g.id === id || g.name.toLowerCase() === name.toLowerCase());
	if (same) return { success: true, data: { id: same.id, position: same.position } };

	const position = generateKeyBetween(existing.at(-1)?.position ?? null, null);
	const [group] = await db
		.insert(seiryuGroups)
		.values({ id, projectId, name, position })
		.onConflictDoNothing()
		.returning({ id: seiryuGroups.id, position: seiryuGroups.position });
	if (!group) return { error: "A group with this name already exists" };

	revalidatePath(`/seiryu/${projectId}`);
	return { success: true, data: group };
}

export async function updateGroup(input: unknown): Promise<{ error: string } | { success: true }> {
	const workspace = await requireWorkspace();

	const parsed = updateGroupSchema.safeParse(input);
	if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

	const { groupId, ...updates } = parsed.data;
	const group = await getOwnedGroup(groupId, workspace.id);
	if (!group) return { error: "Group not found" };
	if (!updates.name && !updates.position) return { success: true };

	try {
		await db.update(seiryuGroups).set(updates).where(eq(seiryuGroups.id, groupId));
	} catch {
		return { error: "A group with this name already exists" };
	}

	revalidatePath(`/seiryu/${group.projectId}`);
	return { success: true };
}

/** The group goes; its cards stay, in no group. */
export async function deleteGroup(input: unknown): Promise<{ error: string } | { success: true }> {
	const workspace = await requireWorkspace();

	const parsed = deleteGroupSchema.safeParse(input);
	if (!parsed.success) return { error: "Invalid input" };

	const group = await getOwnedGroup(parsed.data.groupId, workspace.id);
	if (!group) return { error: "Group not found" };

	await db.delete(seiryuGroups).where(eq(seiryuGroups.id, parsed.data.groupId));

	revalidatePath(`/seiryu/${group.projectId}`);
	return { success: true };
}
