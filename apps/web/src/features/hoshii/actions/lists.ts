"use server";

import { revalidateHoshii } from "@/features/hoshii/actions/guard";
import { listNameSchema } from "@/features/hoshii/lib/hoshii-schemas";
import { generateKeyBetween } from "@/lib/position";
import { getCurrentWorkspace } from "@/lib/session";
import { and, db, eq, hoshiiLists } from "@seikatsu/db";

type Result = { error: string } | { success: true };
const TAKEN = "There's a list with that name";

async function ownedList(listId: string) {
	const ws = await getCurrentWorkspace();
	if (!ws) return null;
	const [list] = await db
		.select()
		.from(hoshiiLists)
		.where(and(eq(hoshiiLists.id, listId), eq(hoshiiLists.workspaceId, ws.id)))
		.limit(1);
	return list ?? null;
}

/** A new list at the end. */
export async function createList(
	name: string,
): Promise<{ error: string } | { success: true; data: { id: string; name: string } }> {
	const ws = await getCurrentWorkspace();
	if (!ws) return { error: "Not signed in" };
	const parsed = listNameSchema.safeParse(name);
	if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid name" };

	const existing = await db
		.select({ position: hoshiiLists.position })
		.from(hoshiiLists)
		.where(eq(hoshiiLists.workspaceId, ws.id));
	const last = existing
		.map((l) => l.position)
		.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
		.at(-1);
	const [row] = await db
		.insert(hoshiiLists)
		.values({
			workspaceId: ws.id,
			name: parsed.data,
			position: generateKeyBetween(last ?? null, null),
		})
		.onConflictDoNothing()
		.returning({ id: hoshiiLists.id, name: hoshiiLists.name });
	if (!row) return { error: TAKEN };
	revalidateHoshii();
	return { success: true, data: row };
}

export async function renameList(listId: string, name: string): Promise<Result> {
	const list = await ownedList(listId);
	if (!list) return { error: "List not found" };
	const parsed = listNameSchema.safeParse(name);
	if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid name" };
	try {
		await db.update(hoshiiLists).set({ name: parsed.data }).where(eq(hoshiiLists.id, listId));
	} catch {
		return { error: TAKEN };
	}
	revalidateHoshii();
	return { success: true };
}

/** A new place among the lists. */
export async function moveList(listId: string, position: string): Promise<Result> {
	if (!/^[0-9A-Za-z]{1,64}$/.test(position)) return { error: "Invalid position" };
	if (!(await ownedList(listId))) return { error: "List not found" };
	await db.update(hoshiiLists).set({ position }).where(eq(hoshiiLists.id, listId));
	revalidateHoshii();
	return { success: true };
}

/** The list goes; its wants stay, in no list. */
export async function deleteList(listId: string): Promise<Result> {
	if (!(await ownedList(listId))) return { error: "List not found" };
	await db.delete(hoshiiLists).where(eq(hoshiiLists.id, listId));
	revalidateHoshii();
	return { success: true };
}
