"use server";

import {
	getOwnedBook,
	getOwnedSession,
	isOwnedBook,
	requireWorkspace,
} from "@/features/tsundoku/actions/guard";
import { pagesLeft, progressPatch } from "@/features/tsundoku/lib/progress";
import { logSessionSchema } from "@/features/tsundoku/lib/tsundoku-schemas";
import { getUserToday } from "@/lib/timezone";
import { db, desc, eq, tsundokuBooks, tsundokuSessions } from "@seikatsu/db";
import { revalidatePath } from "next/cache";

export type TsundokuSession = typeof tsundokuSessions.$inferSelect;

type Result = { error: string } | { success: true };

export async function getSessions(bookId: string): Promise<TsundokuSession[]> {
	const workspace = await requireWorkspace();
	if (!(await isOwnedBook(bookId, workspace.id))) return [];
	return db
		.select()
		.from(tsundokuSessions)
		.where(eq(tsundokuSessions.bookId, bookId))
		.orderBy(desc(tsundokuSessions.date), desc(tsundokuSessions.createdAt));
}

/** A dated session (back-dating): the pages move the book forward like progress does. */
export async function logSession(bookId: string, input: unknown): Promise<Result> {
	const workspace = await requireWorkspace();
	const parsed = logSessionSchema.safeParse(input);
	if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
	const book = await getOwnedBook(bookId, workspace.id);
	if (!book) return { error: "Book not found" };

	const { date } = parsed.data;
	const today = await getUserToday();
	if (date > today) return { error: "Can't log a future day" };
	// A session never reads past the last page, so deleting it later takes back what it added.
	const pagesRead = pagesLeft(book, parsed.data.pagesRead);
	if (pagesRead === 0) return { error: "Already on the last page" };
	const patch = progressPatch(book, book.currentPage + pagesRead, today);
	// The day it was read, not the day it was logged.
	const startedAt = patch.startedAt ?? book.startedAt;
	if (!startedAt || date < startedAt) patch.startedAt = date;
	if (patch.finishedAt) patch.finishedAt = date;

	await db.transaction(async (tx) => {
		await tx.insert(tsundokuSessions).values({ bookId, date, pagesRead });
		await tx.update(tsundokuBooks).set(patch).where(eq(tsundokuBooks.id, bookId));
	});

	revalidatePath("/tsundoku", "layout");
	return { success: true };
}

/** Removing a session takes its pages back off the book (and reopens it if it was finished). */
export async function deleteSession(sessionId: string): Promise<Result> {
	const workspace = await requireWorkspace();
	const session = await getOwnedSession(sessionId, workspace.id);
	if (!session) return { error: "Session not found" };

	const { book, pagesRead } = session;
	const today = await getUserToday();
	await db.transaction(async (tx) => {
		await tx.delete(tsundokuSessions).where(eq(tsundokuSessions.id, sessionId));
		await tx
			.update(tsundokuBooks)
			.set(progressPatch(book, book.currentPage - pagesRead, today))
			.where(eq(tsundokuBooks.id, book.id));
	});

	revalidatePath("/tsundoku", "layout");
	return { success: true };
}
