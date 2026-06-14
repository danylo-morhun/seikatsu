"use server";

import { getOwnedWorkspace } from "@/features/tsundoku/actions/guard";
import { generateKeyBetween } from "@/features/tsundoku/lib/position";
import {
	type CreateShelfValues,
	createShelfSchema,
} from "@/features/tsundoku/lib/tsundoku-schemas";
import { asc, db, desc, eq, tsundokuShelves } from "@seikatsu/db";
import { revalidatePath } from "next/cache";

export type TsundokuShelf = typeof tsundokuShelves.$inferSelect;

export async function getShelves(workspaceId: string): Promise<TsundokuShelf[]> {
	const ws = await getOwnedWorkspace(workspaceId);
	if (!ws) throw new Error("Forbidden");
	return db
		.select()
		.from(tsundokuShelves)
		.where(eq(tsundokuShelves.workspaceId, workspaceId))
		.orderBy(asc(tsundokuShelves.position));
}

export async function createShelf(
	workspaceId: string,
	values: CreateShelfValues,
): Promise<{ error: string } | { success: true; id: string }> {
	const ws = await getOwnedWorkspace(workspaceId);
	if (!ws) return { error: "Forbidden" };

	const parsed = createShelfSchema.safeParse(values);
	if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

	const [last] = await db
		.select({ position: tsundokuShelves.position })
		.from(tsundokuShelves)
		.where(eq(tsundokuShelves.workspaceId, workspaceId))
		.orderBy(desc(tsundokuShelves.position))
		.limit(1);
	const position = generateKeyBetween(last?.position ?? null, null);

	const [inserted] = await db
		.insert(tsundokuShelves)
		.values({
			workspaceId,
			name: parsed.data.name.trim(),
			color: parsed.data.color ?? null,
			position,
		})
		.returning({ id: tsundokuShelves.id });

	revalidatePath("/tsundoku");
	return { success: true, id: inserted.id };
}

export async function updateShelf(
	shelfId: string,
	values: CreateShelfValues,
): Promise<{ error: string } | { success: true }> {
	const [shelf] = await db
		.select()
		.from(tsundokuShelves)
		.where(eq(tsundokuShelves.id, shelfId))
		.limit(1);
	if (!shelf) return { error: "Shelf not found" };
	const ws = await getOwnedWorkspace(shelf.workspaceId);
	if (!ws) return { error: "Forbidden" };

	const parsed = createShelfSchema.safeParse(values);
	if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

	await db
		.update(tsundokuShelves)
		.set({ name: parsed.data.name.trim(), color: parsed.data.color ?? null })
		.where(eq(tsundokuShelves.id, shelfId));
	revalidatePath("/tsundoku");
	return { success: true };
}

export async function deleteShelf(shelfId: string): Promise<{ error: string } | { success: true }> {
	const [shelf] = await db
		.select()
		.from(tsundokuShelves)
		.where(eq(tsundokuShelves.id, shelfId))
		.limit(1);
	if (!shelf) return { error: "Shelf not found" };
	const ws = await getOwnedWorkspace(shelf.workspaceId);
	if (!ws) return { error: "Forbidden" };

	await db.delete(tsundokuShelves).where(eq(tsundokuShelves.id, shelfId));
	revalidatePath("/tsundoku");
	return { success: true };
}
