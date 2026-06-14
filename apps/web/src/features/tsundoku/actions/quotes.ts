"use server";

import { getOwnedBook } from "@/features/tsundoku/actions/guard";
import {
	type CreateQuoteValues,
	createQuoteSchema,
} from "@/features/tsundoku/lib/tsundoku-schemas";
import { db, desc, eq, tsundokuQuotes } from "@seikatsu/db";
import { revalidatePath } from "next/cache";

export type TsundokuQuote = typeof tsundokuQuotes.$inferSelect;

export async function getQuotes(bookId: string): Promise<TsundokuQuote[]> {
	const book = await getOwnedBook(bookId);
	if (!book) return [];
	return db
		.select()
		.from(tsundokuQuotes)
		.where(eq(tsundokuQuotes.bookId, bookId))
		.orderBy(desc(tsundokuQuotes.createdAt));
}

export async function createQuote(
	bookId: string,
	values: CreateQuoteValues,
): Promise<{ error: string } | { success: true }> {
	const book = await getOwnedBook(bookId);
	if (!book) return { error: "Book not found" };

	const parsed = createQuoteSchema.safeParse(values);
	if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

	await db
		.insert(tsundokuQuotes)
		.values({ bookId, text: parsed.data.text.trim(), page: parsed.data.page ?? null });
	revalidatePath(`/tsundoku/${bookId}`);
	return { success: true };
}

export async function deleteQuote(quoteId: string): Promise<{ error: string } | { success: true }> {
	const [row] = await db
		.select({ bookId: tsundokuQuotes.bookId })
		.from(tsundokuQuotes)
		.where(eq(tsundokuQuotes.id, quoteId))
		.limit(1);
	if (!row) return { error: "Quote not found" };
	const book = await getOwnedBook(row.bookId);
	if (!book) return { error: "Forbidden" };

	await db.delete(tsundokuQuotes).where(eq(tsundokuQuotes.id, quoteId));
	revalidatePath(`/tsundoku/${row.bookId}`);
	return { success: true };
}
