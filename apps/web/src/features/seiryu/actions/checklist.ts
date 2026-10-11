"use server";

import {
	getOwnedCard,
	getOwnedChecklistItem,
	requireWorkspace,
} from "@/features/seiryu/actions/guard";
import { generateKeyBetween } from "@/features/seiryu/lib/position";
import {
	createChecklistItemSchema,
	deleteChecklistItemSchema,
	reorderChecklistItemSchema,
	toggleChecklistItemSchema,
} from "@/features/seiryu/lib/seiryu-schemas";
import { db, desc, eq, seiryuChecklistItems } from "@seikatsu/db";
import { revalidatePath } from "next/cache";

export async function createChecklistItem(
	input: unknown,
): Promise<{ error: string } | { success: true; data: { id: string; position: string } }> {
	const workspace = await requireWorkspace();

	const parsed = createChecklistItemSchema.safeParse(input);
	if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

	const { cardId, title } = parsed.data;

	const card = await getOwnedCard(cardId, workspace.id);
	if (!card) return { error: "Card not found" };

	const [last] = await db
		.select({ position: seiryuChecklistItems.position })
		.from(seiryuChecklistItems)
		.where(eq(seiryuChecklistItems.cardId, cardId))
		.orderBy(desc(seiryuChecklistItems.position))
		.limit(1);

	const [item] = await db
		.insert(seiryuChecklistItems)
		.values({ cardId, title, position: generateKeyBetween(last?.position ?? null, null) })
		.returning({ id: seiryuChecklistItems.id, position: seiryuChecklistItems.position });

	if (!item) return { error: "Failed to create item" };

	revalidatePath(`/seiryu/${card.projectId}`);
	return { success: true, data: { id: item.id, position: item.position } };
}

export async function toggleChecklistItem(
	input: unknown,
): Promise<{ error: string } | { success: true }> {
	const workspace = await requireWorkspace();

	const parsed = toggleChecklistItemSchema.safeParse(input);
	if (!parsed.success) return { error: "Invalid input" };

	const item = await getOwnedChecklistItem(parsed.data.itemId, workspace.id);
	if (!item) return { error: "Item not found" };

	await db
		.update(seiryuChecklistItems)
		.set({ isCompleted: !item.isCompleted })
		.where(eq(seiryuChecklistItems.id, parsed.data.itemId));

	revalidatePath(`/seiryu/${item.projectId}`);
	return { success: true };
}

export async function deleteChecklistItem(
	input: unknown,
): Promise<{ error: string } | { success: true }> {
	const workspace = await requireWorkspace();

	const parsed = deleteChecklistItemSchema.safeParse(input);
	if (!parsed.success) return { error: "Invalid input" };

	const item = await getOwnedChecklistItem(parsed.data.itemId, workspace.id);
	if (!item) return { error: "Item not found" };

	await db.delete(seiryuChecklistItems).where(eq(seiryuChecklistItems.id, parsed.data.itemId));

	revalidatePath(`/seiryu/${item.projectId}`);
	return { success: true };
}

export async function reorderChecklistItems(
	input: unknown,
): Promise<{ error: string } | { success: true }> {
	const workspace = await requireWorkspace();

	const parsed = reorderChecklistItemSchema.safeParse(input);
	if (!parsed.success) return { error: "Invalid input" };

	const { itemId, newPosition } = parsed.data;

	const item = await getOwnedChecklistItem(itemId, workspace.id);
	if (!item) return { error: "Item not found" };

	await db
		.update(seiryuChecklistItems)
		.set({ position: newPosition })
		.where(eq(seiryuChecklistItems.id, itemId));

	revalidatePath(`/seiryu/${item.projectId}`);
	return { success: true };
}
