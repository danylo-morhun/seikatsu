"use server";

import {
	getOwnedBook,
	getOwnedSession,
	isOwnedBook,
	requireWorkspace,
} from "@/features/tsundoku/actions/guard";
import { pagesLeft, progressPatch, sessionEditPatch } from "@/features/tsundoku/lib/progress";
import { logSessionSchema } from "@/features/tsundoku/lib/tsundoku-schemas";
import { getUserToday } from "@/lib/timezone";
import { db, desc, eq, tsundokuBooks, tsundokuSessions } from "@seikatsu/db";
import { revalidatePath } from "next/cache";

export type TsundokuSession = typeof tsundokuSessions.$inferSelect;

type Result = { error: string } | { success: true };

/** Pages already in the book's sessions: what a session can still add is checked against it. */
async function loggedPages(bookId: string): Promise<number> {
	const rows = await db
		.select({ pagesRead: tsundokuSessions.pagesRead })
		.from(tsundokuSessions)
		.where(eq(tsundokuSessions.bookId, bookId));
	return rows.reduce((sum, r) => sum + r.pagesRead, 0);
}

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

	const { id, date } = parsed.data;
	const today = await getUserToday();
	if (date > today) return { error: "Can't log a future day" };
	// Sent again (offline replay, lost response): the first one stands.
	if (id && (await getOwnedSession(id, workspace.id))) return { success: true };
	// The log never holds more pages than the book, so deleting a session takes back what it added.
	const pagesRead = pagesLeft(book.pageCount, await loggedPages(bookId), parsed.data.pagesRead);
	if (pagesRead === 0) return { error: "Every page is already logged" };
	const patch = progressPatch(book, book.currentPage + pagesRead, today);
	// The day it was read, not the day it was logged.
	const startedAt = patch.startedAt ?? book.startedAt;
	if (!startedAt || date < startedAt) patch.startedAt = date;
	if (patch.finishedAt) patch.finishedAt = date;

	await db.transaction(async (tx) => {
		await tx.insert(tsundokuSessions).values({ id, bookId, date, pagesRead });
		await tx.update(tsundokuBooks).set(patch).where(eq(tsundokuBooks.id, bookId));
	});

	revalidatePath("/tsundoku", "layout");
	return { success: true };
}

/** Correcting a logged day: its date, its pages, and the book's progress with them. */
export async function updateSession(sessionId: string, input: unknown): Promise<Result> {
	const workspace = await requireWorkspace();
	const parsed = logSessionSchema.safeParse(input);
	if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
	const session = await getOwnedSession(sessionId, workspace.id);
	if (!session) return { error: "Session not found" };

	const today = await getUserToday();
	if (parsed.data.date > today) return { error: "Can't log a future day" };
	const { book } = session;
	const logged = await loggedPages(book.id);
	const { pagesRead, patch } = sessionEditPatch(book, logged, session, parsed.data, today);

	await db.transaction(async (tx) => {
		await tx
			.update(tsundokuSessions)
			.set({ date: parsed.data.date, pagesRead })
			.where(eq(tsundokuSessions.id, sessionId));
		await tx.update(tsundokuBooks).set(patch).where(eq(tsundokuBooks.id, book.id));
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
