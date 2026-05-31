"use server";

import { auth } from "@/auth";
import { getWorkspace } from "@/features/midas/actions/workspace";
import { generateKeyBetween } from "@/features/tasso/lib/position";
import {
	createChecklistItemSchema,
	deleteChecklistItemSchema,
	reorderChecklistItemSchema,
	toggleChecklistItemSchema,
} from "@/features/tasso/lib/tasso-schemas";
import { and, asc, db, eq, tassoCards, tassoChecklistItems, tassoProjects } from "@ethos/db";
import { revalidatePath } from "next/cache";

async function getAuthedWorkspace() {
	const session = await auth();
	if (!session?.user?.id) throw new Error("Unauthorized");
	const workspace = await getWorkspace(session.user.id);
	if (!workspace) throw new Error("Workspace not found");
	return { workspace };
}

async function assertCardOwnership(cardId: string, workspaceId: string) {
	const [card] = await db
		.select({ projectId: tassoCards.projectId })
		.from(tassoCards)
		.where(eq(tassoCards.id, cardId))
		.limit(1);
	if (!card) return null;

	const [project] = await db
		.select({ id: tassoProjects.id })
		.from(tassoProjects)
		.where(and(eq(tassoProjects.id, card.projectId), eq(tassoProjects.workspaceId, workspaceId)))
		.limit(1);
	if (!project) return null;

	return { projectId: card.projectId };
}

export async function getChecklistItems(cardId: string) {
	const { workspace } = await getAuthedWorkspace();
	const ownership = await assertCardOwnership(cardId, workspace.id);
	if (!ownership) throw new Error("Forbidden");

	return db
		.select()
		.from(tassoChecklistItems)
		.where(eq(tassoChecklistItems.cardId, cardId))
		.orderBy(asc(tassoChecklistItems.position));
}

export async function createChecklistItem(
	input: unknown,
): Promise<{ error: string } | { success: true; data: { id: string; position: string } }> {
	const { workspace } = await getAuthedWorkspace();

	const parsed = createChecklistItemSchema.safeParse(input);
	if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

	const { cardId, title } = parsed.data;

	const ownership = await assertCardOwnership(cardId, workspace.id);
	if (!ownership) return { error: "Forbidden" };

	const existing = await db
		.select({ position: tassoChecklistItems.position })
		.from(tassoChecklistItems)
		.where(eq(tassoChecklistItems.cardId, cardId))
		.orderBy(asc(tassoChecklistItems.position));

	const lastPos = existing.at(-1)?.position ?? null;
	const position = generateKeyBetween(lastPos, null);

	const [item] = await db
		.insert(tassoChecklistItems)
		.values({ cardId, title, position })
		.returning({ id: tassoChecklistItems.id, position: tassoChecklistItems.position });

	if (!item) return { error: "Failed to create item" };

	revalidatePath(`/tasso/${ownership.projectId}`);
	return { success: true, data: { id: item.id, position: item.position } };
}

export async function toggleChecklistItem(
	input: unknown,
): Promise<{ error: string } | { success: true }> {
	const { workspace } = await getAuthedWorkspace();

	const parsed = toggleChecklistItemSchema.safeParse(input);
	if (!parsed.success) return { error: "Invalid input" };

	const { itemId } = parsed.data;

	const [item] = await db
		.select({ cardId: tassoChecklistItems.cardId, isCompleted: tassoChecklistItems.isCompleted })
		.from(tassoChecklistItems)
		.where(eq(tassoChecklistItems.id, itemId))
		.limit(1);

	if (!item) return { error: "Not found" };

	const ownership = await assertCardOwnership(item.cardId, workspace.id);
	if (!ownership) return { error: "Forbidden" };

	await db
		.update(tassoChecklistItems)
		.set({ isCompleted: !item.isCompleted })
		.where(eq(tassoChecklistItems.id, itemId));

	revalidatePath(`/tasso/${ownership.projectId}`);
	return { success: true };
}

export async function deleteChecklistItem(
	input: unknown,
): Promise<{ error: string } | { success: true }> {
	const { workspace } = await getAuthedWorkspace();

	const parsed = deleteChecklistItemSchema.safeParse(input);
	if (!parsed.success) return { error: "Invalid input" };

	const { itemId } = parsed.data;

	const [item] = await db
		.select({ cardId: tassoChecklistItems.cardId })
		.from(tassoChecklistItems)
		.where(eq(tassoChecklistItems.id, itemId))
		.limit(1);

	if (!item) return { error: "Not found" };

	const ownership = await assertCardOwnership(item.cardId, workspace.id);
	if (!ownership) return { error: "Forbidden" };

	await db.delete(tassoChecklistItems).where(eq(tassoChecklistItems.id, itemId));

	revalidatePath(`/tasso/${ownership.projectId}`);
	return { success: true };
}

export async function reorderChecklistItems(
	input: unknown,
): Promise<{ error: string } | { success: true }> {
	const { workspace } = await getAuthedWorkspace();

	const parsed = reorderChecklistItemSchema.safeParse(input);
	if (!parsed.success) return { error: "Invalid input" };

	const { itemId, newPosition } = parsed.data;

	const [item] = await db
		.select({ cardId: tassoChecklistItems.cardId })
		.from(tassoChecklistItems)
		.where(eq(tassoChecklistItems.id, itemId))
		.limit(1);

	if (!item) return { error: "Not found" };

	const ownership = await assertCardOwnership(item.cardId, workspace.id);
	if (!ownership) return { error: "Forbidden" };

	await db
		.update(tassoChecklistItems)
		.set({ position: newPosition })
		.where(eq(tassoChecklistItems.id, itemId));

	revalidatePath(`/tasso/${ownership.projectId}`);
	return { success: true };
}
