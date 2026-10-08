// Shared ownership guards for tsundoku server actions.
// Not a "use server" module — these are helpers called inside server actions.

import { getCurrentWorkspace, getSessionUserId } from "@/lib/session";
import { and, db, eq, inArray, tsundokuBooks, tsundokuShelves } from "@seikatsu/db";
import { cache } from "react";

export { getOwnedWorkspace } from "@/lib/session";

export async function requireUser(): Promise<string | null> {
	return getSessionUserId();
}

/** Returns the book row if it belongs to the current user's workspace, else null. */
export async function getOwnedBook(bookId: string) {
	const ws = await getCurrentWorkspace();
	if (!ws) return null;
	const [book] = await db
		.select()
		.from(tsundokuBooks)
		.where(and(eq(tsundokuBooks.id, bookId), eq(tsundokuBooks.workspaceId, ws.id)))
		.limit(1);
	return book ?? null;
}

/**
 * Ownership only, cached per request: the book page loads sessions and quotes in parallel
 * and both check the same book. (The row itself isn't cached — after an action the
 * re-render must read the updated book.)
 */
export const isOwnedBook = cache(async (bookId: string) => (await getOwnedBook(bookId)) != null);

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
