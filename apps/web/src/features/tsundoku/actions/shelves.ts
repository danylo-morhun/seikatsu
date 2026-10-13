"use server";

import { isUuid, requireWorkspace } from "@/features/tsundoku/actions/guard";
import { shelfSchema } from "@/features/tsundoku/lib/tsundoku-schemas";
import { generateKeyBetween } from "@/lib/position";
import { and, asc, count, db, desc, eq, tsundokuBookShelves, tsundokuShelves } from "@seikatsu/db";
import { revalidatePath } from "next/cache";

export type TsundokuShelf = typeof tsundokuShelves.$inferSelect;
export type ShelfWithCount = TsundokuShelf & { bookCount: number };

type Result<T = object> = { error: string } | ({ success: true } & T);

function revalidate() {
	revalidatePath("/tsundoku", "layout");
	revalidatePath("/settings/tsundoku");
}

export async function getShelves(): Promise<TsundokuShelf[]> {
	const workspace = await requireWorkspace();
	return db
		.select()
		.from(tsundokuShelves)
		.where(eq(tsundokuShelves.workspaceId, workspace.id))
		.orderBy(asc(tsundokuShelves.position));
}

/** Shelves with how many books sit on each (settings). */
export async function getShelvesWithCounts(): Promise<ShelfWithCount[]> {
	const workspace = await requireWorkspace();
	return db
		.select({
			id: tsundokuShelves.id,
			workspaceId: tsundokuShelves.workspaceId,
			name: tsundokuShelves.name,
			color: tsundokuShelves.color,
			position: tsundokuShelves.position,
			createdAt: tsundokuShelves.createdAt,
			bookCount: count(tsundokuBookShelves.bookId),
		})
		.from(tsundokuShelves)
		.leftJoin(tsundokuBookShelves, eq(tsundokuBookShelves.shelfId, tsundokuShelves.id))
		.where(eq(tsundokuShelves.workspaceId, workspace.id))
		.groupBy(tsundokuShelves.id)
		.orderBy(asc(tsundokuShelves.position));
}

export async function createShelf(input: unknown): Promise<Result<{ id: string }>> {
	const workspace = await requireWorkspace();
	const parsed = shelfSchema.safeParse(input);
	if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

	const [last] = await db
		.select({ position: tsundokuShelves.position })
		.from(tsundokuShelves)
		.where(eq(tsundokuShelves.workspaceId, workspace.id))
		.orderBy(desc(tsundokuShelves.position))
		.limit(1);

	const [inserted] = await db
		.insert(tsundokuShelves)
		.values({
			workspaceId: workspace.id,
			...parsed.data,
			position: generateKeyBetween(last?.position ?? null, null),
		})
		.returning({ id: tsundokuShelves.id });

	revalidate();
	return { success: true, id: inserted.id };
}

export async function updateShelf(shelfId: string, input: unknown): Promise<Result> {
	const workspace = await requireWorkspace();
	const parsed = shelfSchema.safeParse(input);
	if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
	if (!isUuid(shelfId)) return { error: "Shelf not found" };

	const updated = await db
		.update(tsundokuShelves)
		.set(parsed.data)
		.where(and(eq(tsundokuShelves.id, shelfId), eq(tsundokuShelves.workspaceId, workspace.id)))
		.returning({ id: tsundokuShelves.id });
	if (updated.length === 0) return { error: "Shelf not found" };

	revalidate();
	return { success: true };
}

export async function deleteShelf(shelfId: string): Promise<Result> {
	const workspace = await requireWorkspace();
	if (!isUuid(shelfId)) return { error: "Shelf not found" };

	const deleted = await db
		.delete(tsundokuShelves)
		.where(and(eq(tsundokuShelves.id, shelfId), eq(tsundokuShelves.workspaceId, workspace.id)))
		.returning({ id: tsundokuShelves.id });
	if (deleted.length === 0) return { error: "Shelf not found" };

	revalidate();
	return { success: true };
}
