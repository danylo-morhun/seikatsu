"use server";

import { getOwnedBook, getOwnedWorkspace } from "@/features/tsundoku/actions/guard";
import { type LogSessionValues, logSessionSchema } from "@/features/tsundoku/lib/tsundoku-schemas";
import { and, db, desc, eq, gte, sql, tsundokuBooks, tsundokuSessions } from "@seikatsu/db";
import { revalidatePath } from "next/cache";

export type TsundokuSession = typeof tsundokuSessions.$inferSelect;

function today(): string {
	return new Date().toISOString().slice(0, 10);
}

export async function getSessions(bookId: string): Promise<TsundokuSession[]> {
	const book = await getOwnedBook(bookId);
	if (!book) return [];
	return db
		.select()
		.from(tsundokuSessions)
		.where(eq(tsundokuSessions.bookId, bookId))
		.orderBy(desc(tsundokuSessions.date), desc(tsundokuSessions.createdAt));
}

export async function logSession(
	bookId: string,
	values: LogSessionValues,
): Promise<{ error: string } | { success: true }> {
	const book = await getOwnedBook(bookId);
	if (!book) return { error: "Book not found" };

	const parsed = logSessionSchema.safeParse(values);
	if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
	const v = parsed.data;

	const nextPage = book.pageCount
		? Math.min(book.currentPage + v.pagesRead, book.pageCount)
		: book.currentPage + v.pagesRead;

	const patch: Partial<typeof tsundokuBooks.$inferInsert> = { currentPage: nextPage };
	if (book.status === "want" || book.status === "paused") {
		patch.status = "reading";
		if (!book.startedAt) patch.startedAt = today();
	}
	if (book.pageCount && nextPage >= book.pageCount && book.status !== "read") {
		patch.status = "read";
		patch.finishedAt = today();
	}

	await db.transaction(async (tx) => {
		await tx.insert(tsundokuSessions).values({ bookId, date: v.date, pagesRead: v.pagesRead });
		await tx.update(tsundokuBooks).set(patch).where(eq(tsundokuBooks.id, bookId));
	});

	revalidatePath("/tsundoku");
	revalidatePath(`/tsundoku/${bookId}`);
	revalidatePath("/tsundoku/stats");
	return { success: true };
}

export async function deleteSession(
	sessionId: string,
): Promise<{ error: string } | { success: true }> {
	const [row] = await db
		.select({ bookId: tsundokuSessions.bookId })
		.from(tsundokuSessions)
		.where(eq(tsundokuSessions.id, sessionId))
		.limit(1);
	if (!row) return { error: "Session not found" };
	const book = await getOwnedBook(row.bookId);
	if (!book) return { error: "Forbidden" };

	await db.delete(tsundokuSessions).where(eq(tsundokuSessions.id, sessionId));
	revalidatePath(`/tsundoku/${row.bookId}`);
	revalidatePath("/tsundoku/stats");
	return { success: true };
}

export interface HeatmapDay {
	date: string;
	pages: number;
}

/** Reading days across the workspace for the last N days (GitHub-style heatmap). */
export async function getReadingHeatmap(workspaceId: string, days = 365): Promise<HeatmapDay[]> {
	const ws = await getOwnedWorkspace(workspaceId);
	if (!ws) return [];

	const since = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);

	const rows = await db
		.select({
			date: tsundokuSessions.date,
			pages: sql<number>`sum(${tsundokuSessions.pagesRead})::int`,
		})
		.from(tsundokuSessions)
		.innerJoin(tsundokuBooks, eq(tsundokuSessions.bookId, tsundokuBooks.id))
		.where(and(eq(tsundokuBooks.workspaceId, workspaceId), gte(tsundokuSessions.date, since)))
		.groupBy(tsundokuSessions.date);

	return rows.map((r) => ({ date: r.date, pages: Number(r.pages) }));
}
