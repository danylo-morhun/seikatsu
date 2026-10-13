import { z } from "zod";
import { BOOK_STATUSES, RATING_MAX } from "./constants";

// "" and whitespace clear the field (null); a missing key leaves it alone (partial updates).
const text = (max: number) =>
	z
		.string()
		.max(max)
		.nullable()
		.transform((v) => v?.trim() || null);

const MAX_PAGES = 100_000;
const positiveInt = z.number().int().positive().max(MAX_PAGES).nullable();

export const bookStatusSchema = z.enum(BOOK_STATUSES);

const bookFields = {
	title: z.string().trim().min(1, "Title required").max(500),
	authors: z.array(z.string().trim().min(1).max(200)).max(20),
	isbn: text(32),
	coverUrl: text(2000).refine((v) => v == null || /^https:\/\//.test(v), "Cover must be https"),
	pageCount: positiveInt,
	publishedYear: z.number().int().min(0).max(3000).nullable(),
	description: text(20_000),
	genre: text(100),
	seriesName: text(300),
	seriesPosition: positiveInt,
	rating: z.number().int().min(1).max(RATING_MAX).nullable(),
	review: text(20_000),
};

// Create a book — from a search snapshot or manual entry.
export const createBookSchema = z.object({
	...bookFields,
	authors: bookFields.authors.default([]),
	isbn: bookFields.isbn.default(null),
	coverUrl: bookFields.coverUrl.default(null),
	pageCount: positiveInt.default(null),
	publishedYear: bookFields.publishedYear.default(null),
	description: bookFields.description.default(null),
	genre: bookFields.genre.default(null),
	seriesName: bookFields.seriesName.default(null),
	seriesPosition: positiveInt.default(null),
	rating: bookFields.rating.default(null),
	review: bookFields.review.default(null),
	olKey: text(200).default(null),
	source: z.enum(["openlibrary", "google", "manual"]).default("manual"),
	status: bookStatusSchema.default("want"),
});
export type CreateBookValues = z.input<typeof createBookSchema>;

// Changed fields only: the book page autosaves one field at a time.
export const updateBookSchema = z.object(bookFields).partial();
export type UpdateBookValues = z.input<typeof updateBookSchema>;

export const logSessionSchema = z.object({
	date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date"),
	pagesRead: z.number().int().positive("Pages must be positive").max(MAX_PAGES),
});
export type LogSessionValues = z.infer<typeof logSessionSchema>;

export const setProgressSchema = z.object({
	currentPage: z.number().int().min(0).max(MAX_PAGES),
});

export const shelfSchema = z.object({
	name: z.string().trim().min(1, "Name required").max(100),
	color: z.string().max(32).nullable().default(null),
});
export type ShelfValues = z.input<typeof shelfSchema>;

export const createQuoteSchema = z.object({
	text: z.string().trim().min(1, "Quote required").max(5000),
	page: positiveInt.default(null),
});
export type CreateQuoteValues = z.input<typeof createQuoteSchema>;

export const setGoalSchema = z.object({
	year: z.number().int().min(1900).max(3000),
	targetBooks: z.number().int().min(1).max(10000),
});
export type SetGoalValues = z.infer<typeof setGoalSchema>;
