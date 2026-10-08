"use server";

import {
	assertShelvesInWorkspace,
	getOwnedBook,
	getOwnedWorkspace,
} from "@/features/tsundoku/actions/guard";
import { generateKeyBetween } from "@/features/tsundoku/lib/position";
import {
	type CreateBookValues,
	type UpdateBookValues,
	bookStatusSchema,
	createBookSchema,
	updateBookSchema,
} from "@/features/tsundoku/lib/tsundoku-schemas";
import { and, asc, db, desc, eq, inArray, tsundokuBookShelves, tsundokuBooks } from "@seikatsu/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export type TsundokuBook = typeof tsundokuBooks.$inferSelect & { shelfIds: string[] };

// What the library grid/list, filters and sorts read. The full row (description, review…)
// is only needed on the book page, and the library list is sent to the client whole.
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
	finishedAt: tsundokuBooks.finishedAt,
};

export type LibraryBook = Pick<TsundokuBook, keyof typeof libraryColumns> & {
	shelfIds: string[];
};

export type SeriesBook = Pick<TsundokuBook, "id" | "title" | "status" | "seriesPosition">;

function today(): string {
	return new Date().toISOString().slice(0, 10);
}

export async function getBooks(workspaceId: string): Promise<LibraryBook[]> {
	const ws = await getOwnedWorkspace(workspaceId);
	if (!ws) throw new Error("Forbidden");

	const books = await db
		.select(libraryColumns)
		.from(tsundokuBooks)
		.where(eq(tsundokuBooks.workspaceId, workspaceId))
		.orderBy(asc(tsundokuBooks.position), desc(tsundokuBooks.createdAt));

	if (books.length === 0) return [];

	const memberships = await db
		.select({ bookId: tsundokuBookShelves.bookId, shelfId: tsundokuBookShelves.shelfId })
		.from(tsundokuBookShelves)
		.where(
			inArray(
				tsundokuBookShelves.bookId,
				books.map((b) => b.id),
			),
		);

	const byBook = new Map<string, string[]>();
	for (const m of memberships) {
		const arr = byBook.get(m.bookId) ?? [];
		arr.push(m.shelfId);
		byBook.set(m.bookId, arr);
	}

	return books.map((b) => ({ ...b, shelfIds: byBook.get(b.id) ?? [] }));
}

/** Books of one series in the workspace (includes the current book). */
export async function getSeriesBooks(
	workspaceId: string,
	seriesName: string,
): Promise<SeriesBook[]> {
	const ws = await getOwnedWorkspace(workspaceId);
	if (!ws) throw new Error("Forbidden");
	return db
		.select({
			id: tsundokuBooks.id,
			title: tsundokuBooks.title,
			status: tsundokuBooks.status,
			seriesPosition: tsundokuBooks.seriesPosition,
		})
		.from(tsundokuBooks)
		.where(
			and(eq(tsundokuBooks.workspaceId, workspaceId), eq(tsundokuBooks.seriesName, seriesName)),
		);
}

export async function getBook(bookId: string): Promise<TsundokuBook | null> {
	const book = await getOwnedBook(bookId);
	if (!book) return null;
	const memberships = await db
		.select({ shelfId: tsundokuBookShelves.shelfId })
		.from(tsundokuBookShelves)
		.where(eq(tsundokuBookShelves.bookId, bookId));
	return { ...book, shelfIds: memberships.map((m) => m.shelfId) };
}

export async function createBook(
	workspaceId: string,
	values: CreateBookValues,
): Promise<{ error: string } | { success: true; id: string }> {
	const ws = await getOwnedWorkspace(workspaceId);
	if (!ws) return { error: "Forbidden" };

	const parsed = createBookSchema.safeParse(values);
	if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
	const v = parsed.data;

	// Position at the front of the library (newest first when sorted asc by key).
	const [first] = await db
		.select({ position: tsundokuBooks.position })
		.from(tsundokuBooks)
		.where(eq(tsundokuBooks.workspaceId, workspaceId))
		.orderBy(asc(tsundokuBooks.position))
		.limit(1);
	const position = generateKeyBetween(null, first?.position ?? null);

	const startedAt = v.status === "reading" ? today() : null;
	const finishedAt = v.status === "read" ? today() : null;

	const [inserted] = await db
		.insert(tsundokuBooks)
		.values({
			workspaceId,
			title: v.title,
			authors: v.authors ?? [],
			isbn: v.isbn ?? null,
			coverUrl: v.coverUrl ?? null,
			olKey: v.olKey ?? null,
			pageCount: v.pageCount ?? null,
			publishedYear: v.publishedYear ?? null,
			description: v.description ?? null,
			genre: v.genre ?? null,
			seriesName: v.seriesName ?? null,
			seriesPosition: v.seriesPosition ?? null,
			source: v.source,
			status: v.status,
			startedAt,
			finishedAt,
			position,
		})
		.returning({ id: tsundokuBooks.id });

	revalidatePath("/tsundoku");
	return { success: true, id: inserted.id };
}

export async function updateBook(
	bookId: string,
	values: UpdateBookValues,
): Promise<{ error: string } | { success: true }> {
	const book = await getOwnedBook(bookId);
	if (!book) return { error: "Book not found" };

	const parsed = updateBookSchema.safeParse(values);
	if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
	const v = parsed.data;

	await db
		.update(tsundokuBooks)
		.set({
			title: v.title,
			authors: v.authors ?? [],
			isbn: v.isbn ?? null,
			coverUrl: v.coverUrl ?? null,
			pageCount: v.pageCount ?? null,
			publishedYear: v.publishedYear ?? null,
			description: v.description ?? null,
			genre: v.genre ?? null,
			seriesName: v.seriesName ?? null,
			seriesPosition: v.seriesPosition ?? null,
			rating: v.rating ?? null,
			review: v.review ?? null,
		})
		.where(eq(tsundokuBooks.id, bookId));

	revalidatePath("/tsundoku");
	revalidatePath(`/tsundoku/${bookId}`);
	return { success: true };
}

export async function updateStatus(
	bookId: string,
	status: string,
): Promise<{ error: string } | { success: true }> {
	const book = await getOwnedBook(bookId);
	if (!book) return { error: "Book not found" };

	const parsed = bookStatusSchema.safeParse(status);
	if (!parsed.success) return { error: "Invalid status" };
	const next = parsed.data;

	const patch: Partial<typeof tsundokuBooks.$inferInsert> = { status: next };
	// First time moving into "reading" → stamp startedAt if missing.
	if (next === "reading" && !book.startedAt) patch.startedAt = today();
	// Marking read → stamp finishedAt + fill progress to pageCount if known.
	if (next === "read") {
		if (!book.finishedAt) patch.finishedAt = today();
		if (book.pageCount && book.currentPage < book.pageCount) patch.currentPage = book.pageCount;
	}

	await db.update(tsundokuBooks).set(patch).where(eq(tsundokuBooks.id, bookId));
	revalidatePath("/tsundoku");
	revalidatePath(`/tsundoku/${bookId}`);
	return { success: true };
}

export async function updateProgress(
	bookId: string,
	currentPage: number,
): Promise<{ error: string } | { success: true }> {
	const book = await getOwnedBook(bookId);
	if (!book) return { error: "Book not found" };
	if (!Number.isInteger(currentPage) || currentPage < 0) return { error: "Invalid page" };

	const clamped = book.pageCount ? Math.min(currentPage, book.pageCount) : currentPage;
	const patch: Partial<typeof tsundokuBooks.$inferInsert> = { currentPage: clamped };
	if (clamped > 0 && book.status === "want") {
		patch.status = "reading";
		if (!book.startedAt) patch.startedAt = today();
	}
	if (book.pageCount && clamped >= book.pageCount && book.status !== "read") {
		patch.status = "read";
		patch.finishedAt = today();
	}

	await db.update(tsundokuBooks).set(patch).where(eq(tsundokuBooks.id, bookId));
	revalidatePath("/tsundoku");
	revalidatePath(`/tsundoku/${bookId}`);
	return { success: true };
}

export async function updateRating(
	bookId: string,
	rating: number | null,
): Promise<{ error: string } | { success: true }> {
	const book = await getOwnedBook(bookId);
	if (!book) return { error: "Book not found" };
	if (rating != null && (!Number.isInteger(rating) || rating < 1 || rating > 10)) {
		return { error: "Invalid rating" };
	}
	await db.update(tsundokuBooks).set({ rating }).where(eq(tsundokuBooks.id, bookId));
	revalidatePath("/tsundoku");
	revalidatePath(`/tsundoku/${bookId}`);
	return { success: true };
}

/** Deletes and redirects to the library (one round trip; the book page can't re-render). */
export async function deleteBook(bookId: string): Promise<{ error: string }> {
	const book = await getOwnedBook(bookId);
	if (!book) return { error: "Book not found" };
	await db.delete(tsundokuBooks).where(eq(tsundokuBooks.id, bookId));
	revalidatePath("/tsundoku");
	redirect("/tsundoku");
}

export async function setBookShelves(
	bookId: string,
	shelfIds: string[],
): Promise<{ error: string } | { success: true }> {
	const book = await getOwnedBook(bookId);
	if (!book) return { error: "Book not found" };

	if (shelfIds.length > 0) {
		const ok = await assertShelvesInWorkspace(shelfIds, book.workspaceId);
		if (!ok) return { error: "Shelf not found" };
	}

	await db.transaction(async (tx) => {
		await tx.delete(tsundokuBookShelves).where(eq(tsundokuBookShelves.bookId, bookId));
		if (shelfIds.length > 0) {
			await tx.insert(tsundokuBookShelves).values(shelfIds.map((shelfId) => ({ bookId, shelfId })));
		}
	});

	revalidatePath("/tsundoku");
	revalidatePath(`/tsundoku/${bookId}`);
	return { success: true };
}
