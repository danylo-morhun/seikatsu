// Shared ownership guards for tsundoku server actions.
// Not a "use server" module — these are helpers called inside server actions.

import { getSessionUserId } from "@/lib/session";
import { and, db, eq, inArray, tsundokuBooks, tsundokuShelves, workspaces } from "@seikatsu/db";

export { getOwnedWorkspace } from "@/lib/session";

export async function requireUser(): Promise<string | null> {
	return getSessionUserId();
}

/** Returns the book row if it belongs to the current user's workspace, else null. */
export async function getOwnedBook(bookId: string) {
	const userId = await requireUser();
	if (!userId) return null;
	const [row] = await db
		.select({ book: tsundokuBooks, ownerId: workspaces.userId })
		.from(tsundokuBooks)
		.innerJoin(workspaces, eq(tsundokuBooks.workspaceId, workspaces.id))
		.where(eq(tsundokuBooks.id, bookId))
		.limit(1);
	if (!row || row.ownerId !== userId) return null;
	return row.book;
}

/** Verify all shelfIds belong to the given workspace (mirrors assertTagsInWorkspace). */
export async function assertShelvesInWorkspace(
	shelfIds: string[],
	workspaceId: string,
): Promise<boolean> {
	if (shelfIds.length === 0) return true;
	const valid = await db
		.select({ id: tsundokuShelves.id })
		.from(tsundokuShelves)
		.where(
			and(inArray(tsundokuShelves.id, shelfIds), eq(tsundokuShelves.workspaceId, workspaceId)),
		);
	return valid.length === shelfIds.length;
}
