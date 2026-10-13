// Shared ownership guards for tsundoku server actions.
// Not a "use server" module — these are helpers called inside server actions.

import { isUuid } from "@/lib/session";
import {
	and,
	db,
	eq,
	inArray,
	tsundokuBooks,
	tsundokuQuotes,
	tsundokuSessions,
	tsundokuShelves,
} from "@seikatsu/db";
import { cache } from "react";

export { isUuid, requireWorkspace } from "@/lib/session";

/** The book row if it belongs to the workspace, else null. */
export async function getOwnedBook(bookId: string, workspaceId: string) {
	if (!isUuid(bookId)) return null;
	const [book] = await db
		.select()
		.from(tsundokuBooks)
		.where(and(eq(tsundokuBooks.id, bookId), eq(tsundokuBooks.workspaceId, workspaceId)))
		.limit(1);
	return book ?? null;
}

/**
 * Ownership only, cached per request: the book page loads sessions and quotes in parallel
 * and both check the same book. (The row itself isn't cached — after an action the
 * re-render must read the updated book.)
 */
export const isOwnedBook = cache(
	async (bookId: string, workspaceId: string) => (await getOwnedBook(bookId, workspaceId)) != null,
);

/** The session and its book's progress state if it belongs to the workspace — one query. */
export async function getOwnedSession(sessionId: string, workspaceId: string) {
	if (!isUuid(sessionId)) return null;
	const [row] = await db
		.select({
			pagesRead: tsundokuSessions.pagesRead,
			book: {
				id: tsundokuBooks.id,
				status: tsundokuBooks.status,
				currentPage: tsundokuBooks.currentPage,
				pageCount: tsundokuBooks.pageCount,
				startedAt: tsundokuBooks.startedAt,
				finishedAt: tsundokuBooks.finishedAt,
			},
		})
		.from(tsundokuSessions)
		.innerJoin(tsundokuBooks, eq(tsundokuBooks.id, tsundokuSessions.bookId))
		.where(and(eq(tsundokuSessions.id, sessionId), eq(tsundokuBooks.workspaceId, workspaceId)))
		.limit(1);
	return row ?? null;
}

/** The quote's book if it belongs to the workspace — one query. */
export async function getOwnedQuote(quoteId: string, workspaceId: string) {
	if (!isUuid(quoteId)) return null;
	const [row] = await db
		.select({ bookId: tsundokuQuotes.bookId })
		.from(tsundokuQuotes)
		.innerJoin(tsundokuBooks, eq(tsundokuBooks.id, tsundokuQuotes.bookId))
		.where(and(eq(tsundokuQuotes.id, quoteId), eq(tsundokuBooks.workspaceId, workspaceId)))
		.limit(1);
	return row ?? null;
}

/** True if every shelf belongs to the workspace (mirrors assertTagsInWorkspace). */
export async function assertShelvesInWorkspace(
	shelfIds: string[],
	workspaceId: string,
): Promise<boolean> {
	if (shelfIds.length === 0) return true;
	if (!shelfIds.every(isUuid)) return false;
	const valid = await db
		.select({ id: tsundokuShelves.id })
		.from(tsundokuShelves)
		.where(
			and(inArray(tsundokuShelves.id, shelfIds), eq(tsundokuShelves.workspaceId, workspaceId)),
		);
	return valid.length === new Set(shelfIds).size;
}
