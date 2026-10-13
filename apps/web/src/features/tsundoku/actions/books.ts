"use server";

import {
	assertShelvesInWorkspace,
	getOwnedBook,
	requireWorkspace,
} from "@/features/tsundoku/actions/guard";
import { computePace } from "@/features/tsundoku/lib/pace";
import {
	finishDatePatch,
	pageCountPatch,
	progressPatch,
	statusPatch,
} from "@/features/tsundoku/lib/progress";
import { fetchWorkDescription } from "@/features/tsundoku/lib/search-providers";
import {
	bookStatusSchema,
	createBookSchema,
	finishedAtSchema,
	setProgressSchema,
	updateBookSchema,
} from "@/features/tsundoku/lib/tsundoku-schemas";
import { generateKeyBetween } from "@/lib/position";
import { getUserToday } from "@/lib/timezone";
import {
	and,
	asc,
	db,
	desc,
	eq,
	inArray,
	tsundokuBookShelves,
	tsundokuBooks,
	tsundokuSessions,
} from "@seikatsu/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

export type TsundokuBook = typeof tsundokuBooks.$inferSelect & { shelfIds: string[] };

// What the library reads. The full row (description, review…) is only needed on the book
// page, and the library list is sent to the client whole.
const libraryColumns = {
	id: tsundokuBooks.id,
	title: tsundokuBooks.title,
	authors: tsundokuBooks.authors,
	coverUrl: tsundokuBooks.coverUrl,
	status: tsundokuBooks.status,
	rating: tsundokuBooks.rating,
	currentPage: tsundokuBooks.currentPage,
	pageCount: tsundokuBooks.pageCount,
	genre: tsundokuBooks.genre,
	seriesName: tsundokuBooks.seriesName,
	seriesPosition: tsundokuBooks.seriesPosition,
	position: tsundokuBooks.position,
	startedAt: tsundokuBooks.startedAt,
	finishedAt: tsundokuBooks.finishedAt,
	createdAt: tsundokuBooks.createdAt,
};

export type LibraryBook = Pick<TsundokuBook, keyof typeof libraryColumns> & {
	shelfIds: string[];
	/** Reading books with logged pages: days left at the current pace. */
	daysToFinish: number | null;
};

export type SeriesBook = Pick<TsundokuBook, "id" | "title" | "status" | "seriesPosition">;

type Result<T = object> = { error: string } | ({ success: true } & T);

function invalid(error: z.ZodError) {
	return { error: error.issues[0]?.message ?? "Invalid input" };
}

/** Every page that shows books: library, book pages, year. */
function revalidate() {
	revalidatePath("/tsundoku", "layout");
}

export async function getBooks(): Promise<LibraryBook[]> {
	const workspace = await requireWorkspace();
	const books = await db
		.select(libraryColumns)
		.from(tsundokuBooks)
		.where(eq(tsundokuBooks.workspaceId, workspace.id))
		.orderBy(asc(tsundokuBooks.position), desc(tsundokuBooks.createdAt));
	if (books.length === 0) return [];

	const ids = books.map((b) => b.id);
	const readingIds = books.filter((b) => b.status === "reading").map((b) => b.id);
	const [memberships, sessions] = await Promise.all([
		db
			.select({ bookId: tsundokuBookShelves.bookId, shelfId: tsundokuBookShelves.shelfId })
			.from(tsundokuBookShelves)
			.where(inArray(tsundokuBookShelves.bookId, ids)),
		readingIds.length > 0
			? db
					.select({
						bookId: tsundokuSessions.bookId,
						date: tsundokuSessions.date,
						pagesRead: tsundokuSessions.pagesRead,
					})
					.from(tsundokuSessions)
					.where(inArray(tsundokuSessions.bookId, readingIds))
			: [],
	]);

	const shelvesByBook = Map.groupBy(memberships, (m) => m.bookId);
	const sessionsByBook = Map.groupBy(sessions, (s) => s.bookId);
	return books.map((b) => ({
		...b,
		shelfIds: (shelvesByBook.get(b.id) ?? []).map((m) => m.shelfId),
		daysToFinish:
			computePace(sessionsByBook.get(b.id) ?? [], b.currentPage, b.pageCount)?.daysToFinish ?? null,
	}));
}

/** Books of one series (includes the current book). */
export async function getSeriesBooks(seriesName: string): Promise<SeriesBook[]> {
	const workspace = await requireWorkspace();
	return db
		.select({
			id: tsundokuBooks.id,
			title: tsundokuBooks.title,
			status: tsundokuBooks.status,
			seriesPosition: tsundokuBooks.seriesPosition,
		})
		.from(tsundokuBooks)
		.where(
			and(eq(tsundokuBooks.workspaceId, workspace.id), eq(tsundokuBooks.seriesName, seriesName)),
		)
		.orderBy(asc(tsundokuBooks.seriesPosition));
}

export async function getBook(bookId: string): Promise<TsundokuBook | null> {
	const workspace = await requireWorkspace();
	const book = await getOwnedBook(bookId, workspace.id);
	if (!book) return null;
	const memberships = await db
		.select({ shelfId: tsundokuBookShelves.shelfId })
		.from(tsundokuBookShelves)
		.where(eq(tsundokuBookShelves.bookId, bookId));
	return { ...book, shelfIds: memberships.map((m) => m.shelfId) };
}

export async function createBook(input: unknown): Promise<Result<{ id: string }>> {
	const workspace = await requireWorkspace();
	const parsed = createBookSchema.safeParse(input);
	if (!parsed.success) return invalid(parsed.error);
	const { status, ...v } = parsed.data;
	// Open Library leaves the description out of search results; fetch it once, on add.
	if (!v.description && v.source === "openlibrary" && v.olKey) {
		v.description = await fetchWorkDescription(v.olKey);
	}

	// Front of the library: the newest book comes first by position.
	const [first] = await db
		.select({ position: tsundokuBooks.position })
		.from(tsundokuBooks)
		.where(eq(tsundokuBooks.workspaceId, workspace.id))
		.orderBy(asc(tsundokuBooks.position))
		.limit(1);

	const today = await getUserToday();
	const fresh = {
		status: "want" as const,
		currentPage: 0,
		pageCount: v.pageCount,
		startedAt: null,
		finishedAt: null,
	};
	const [inserted] = await db
		.insert(tsundokuBooks)
		.values({
			...v,
			workspaceId: workspace.id,
			...fresh,
			...statusPatch(fresh, status, today),
			position: generateKeyBetween(null, first?.position ?? null),
		})
		.returning({ id: tsundokuBooks.id });

	revalidate();
	return { success: true, id: inserted.id };
}

/** Changed fields only (the book page autosaves one field at a time). */
export async function updateBook(bookId: string, input: unknown): Promise<Result> {
	const workspace = await requireWorkspace();
	const parsed = updateBookSchema.safeParse(input);
	if (!parsed.success) return invalid(parsed.error);
	const book = await getOwnedBook(bookId, workspace.id);
	if (!book) return { error: "Book not found" };

	const patch: Partial<typeof tsundokuBooks.$inferInsert> = parsed.data;
	// A shorter book can't be read past its end.
	const { pageCount } = parsed.data;
	if (pageCount !== undefined && pageCount !== book.pageCount) {
		Object.assign(patch, pageCountPatch(book, pageCount));
	}
	if (Object.keys(patch).length === 0) return { success: true };

	await db.update(tsundokuBooks).set(patch).where(eq(tsundokuBooks.id, bookId));
	revalidate();
	return { success: true };
}

export async function updateStatus(bookId: string, status: unknown): Promise<Result> {
	const workspace = await requireWorkspace();
	const parsed = bookStatusSchema.safeParse(status);
	if (!parsed.success) return { error: "Invalid status" };
	const book = await getOwnedBook(bookId, workspace.id);
	if (!book) return { error: "Book not found" };
	if (book.status === parsed.data) return { success: true };

	const today = await getUserToday();
	await db
		.update(tsundokuBooks)
		.set(statusPatch(book, parsed.data, today))
		.where(eq(tsundokuBooks.id, bookId));
	revalidate();
	return { success: true };
}

/** The day a finished book was finished, set apart from the reading log. */
export async function setFinishedAt(bookId: string, input: unknown): Promise<Result> {
	const workspace = await requireWorkspace();
	const parsed = finishedAtSchema.safeParse(input);
	if (!parsed.success) return { error: "Invalid date" };
	const book = await getOwnedBook(bookId, workspace.id);
	if (!book) return { error: "Book not found" };
	if (book.status !== "read") return { error: "The book isn't finished" };
	if (parsed.data > (await getUserToday())) return { error: "Can't finish on a future day" };

	await db
		.update(tsundokuBooks)
		.set(finishDatePatch(book, parsed.data))
		.where(eq(tsundokuBooks.id, bookId));
	revalidate();
	return { success: true };
}

/**
 * "I'm on page N". Reading forward is a session dated today (added to today's session if
 * there is one), so the streak and pace follow without a separate log.
 */
export async function setProgress(bookId: string, input: unknown): Promise<Result> {
	const workspace = await requireWorkspace();
	const parsed = setProgressSchema.safeParse(input);
	if (!parsed.success) return invalid(parsed.error);
	const book = await getOwnedBook(bookId, workspace.id);
	if (!book) return { error: "Book not found" };

	const today = await getUserToday();
	const patch = progressPatch(book, parsed.data.currentPage, today);
	const delta = (patch.currentPage ?? book.currentPage) - book.currentPage;

	await db.transaction(async (tx) => {
		if (delta > 0) {
			const [todays] = await tx
				.select({ id: tsundokuSessions.id, pagesRead: tsundokuSessions.pagesRead })
				.from(tsundokuSessions)
				.where(and(eq(tsundokuSessions.bookId, bookId), eq(tsundokuSessions.date, today)))
				.limit(1);
			if (todays) {
				await tx
					.update(tsundokuSessions)
					.set({ pagesRead: todays.pagesRead + delta })
					.where(eq(tsundokuSessions.id, todays.id));
			} else {
				await tx.insert(tsundokuSessions).values({ bookId, date: today, pagesRead: delta });
			}
		}
		await tx.update(tsundokuBooks).set(patch).where(eq(tsundokuBooks.id, bookId));
	});

	revalidate();
	return { success: true };
}

const ratingSchema = z.number().int().min(1).max(10).nullable();

export async function updateRating(bookId: string, rating: unknown): Promise<Result> {
	const workspace = await requireWorkspace();
	const parsed = ratingSchema.safeParse(rating);
	if (!parsed.success) return { error: "Invalid rating" };
	const book = await getOwnedBook(bookId, workspace.id);
	if (!book) return { error: "Book not found" };

	await db.update(tsundokuBooks).set({ rating: parsed.data }).where(eq(tsundokuBooks.id, bookId));
	revalidate();
	return { success: true };
}

/** Deletes and, from the book page, redirects to the library in the same round trip. */
export async function deleteBook(
	bookId: string,
	options: { redirect?: boolean } = {},
): Promise<Result> {
	const workspace = await requireWorkspace();
	const book = await getOwnedBook(bookId, workspace.id);
	if (!book) return { error: "Book not found" };

	await db.delete(tsundokuBooks).where(eq(tsundokuBooks.id, bookId));
	revalidate();
	if (options.redirect) redirect("/tsundoku");
	return { success: true };
}

const shelfIdsSchema = z.array(z.string()).max(100);

export async function setBookShelves(bookId: string, shelfIds: unknown): Promise<Result> {
	const workspace = await requireWorkspace();
	const parsed = shelfIdsSchema.safeParse(shelfIds);
	if (!parsed.success) return { error: "Invalid shelves" };
	const ids = [...new Set(parsed.data)];
	const book = await getOwnedBook(bookId, workspace.id);
	if (!book) return { error: "Book not found" };
	if (!(await assertShelvesInWorkspace(ids, workspace.id))) return { error: "Shelf not found" };

	await db.transaction(async (tx) => {
		await tx.delete(tsundokuBookShelves).where(eq(tsundokuBookShelves.bookId, bookId));
		if (ids.length > 0) {
			await tx.insert(tsundokuBookShelves).values(ids.map((shelfId) => ({ bookId, shelfId })));
		}
	});

	revalidate();
	return { success: true };
}
