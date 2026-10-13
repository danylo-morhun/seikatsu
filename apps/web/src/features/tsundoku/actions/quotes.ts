"use server";

import {
	getOwnedBook,
	getOwnedQuote,
	isOwnedBook,
	requireWorkspace,
} from "@/features/tsundoku/actions/guard";
import { createQuoteSchema } from "@/features/tsundoku/lib/tsundoku-schemas";
import { and, db, desc, eq, gte, lte, tsundokuBooks, tsundokuQuotes } from "@seikatsu/db";
import { revalidatePath } from "next/cache";

export type TsundokuQuote = typeof tsundokuQuotes.$inferSelect;

export interface FeedQuote {
	id: string;
	text: string;
	page: number | null;
	bookId: string;
	bookTitle: string;
	bookAuthors: string[] | null;
}

type Result = { error: string } | { success: true };

export async function getQuotes(bookId: string): Promise<TsundokuQuote[]> {
	const workspace = await requireWorkspace();
	if (!(await isOwnedBook(bookId, workspace.id))) return [];
	return db
		.select()
		.from(tsundokuQuotes)
		.where(eq(tsundokuQuotes.bookId, bookId))
		.orderBy(desc(tsundokuQuotes.createdAt));
}

/** Quotes saved during a year, across books (the Year page). */
export async function getYearQuotes(year: number): Promise<FeedQuote[]> {
	const workspace = await requireWorkspace();
	return db
		.select({
			id: tsundokuQuotes.id,
			text: tsundokuQuotes.text,
			page: tsundokuQuotes.page,
			bookId: tsundokuBooks.id,
			bookTitle: tsundokuBooks.title,
			bookAuthors: tsundokuBooks.authors,
		})
		.from(tsundokuQuotes)
		.innerJoin(tsundokuBooks, eq(tsundokuBooks.id, tsundokuQuotes.bookId))
		.where(
			and(
				eq(tsundokuBooks.workspaceId, workspace.id),
				gte(tsundokuQuotes.createdAt, new Date(Date.UTC(year, 0, 1))),
				lte(tsundokuQuotes.createdAt, new Date(Date.UTC(year + 1, 0, 1) - 1)),
			),
		)
		.orderBy(desc(tsundokuQuotes.createdAt))
		.limit(50);
}

export async function createQuote(bookId: string, input: unknown): Promise<Result> {
	const workspace = await requireWorkspace();
	const parsed = createQuoteSchema.safeParse(input);
	if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
	if (!(await getOwnedBook(bookId, workspace.id))) return { error: "Book not found" };

	await db.insert(tsundokuQuotes).values({ bookId, ...parsed.data });
	revalidatePath("/tsundoku", "layout");
	return { success: true };
}

export async function deleteQuote(quoteId: string): Promise<Result> {
	const workspace = await requireWorkspace();
	if (!(await getOwnedQuote(quoteId, workspace.id))) return { error: "Quote not found" };

	await db.delete(tsundokuQuotes).where(eq(tsundokuQuotes.id, quoteId));
	revalidatePath("/tsundoku", "layout");
	return { success: true };
}
