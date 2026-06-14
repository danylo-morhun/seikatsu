import { z } from "zod";
import { BOOK_STATUSES, RATING_MAX } from "./constants";

const optionalText = z
	.string()
	.optional()
	.transform((v) => v?.trim() || undefined);

export const bookStatusSchema = z.enum(BOOK_STATUSES);

// Create a book — from Open Library snapshot or manual entry.
export const createBookSchema = z.object({
	title: z.string().min(1, "Title required").max(500),
	authors: z.array(z.string()).optional(),
	isbn: optionalText,
	coverUrl: optionalText,
	olKey: optionalText,
	pageCount: z.number().int().positive().nullable().optional(),
	publishedYear: z.number().int().nullable().optional(),
	description: optionalText,
	genre: optionalText,
	seriesName: optionalText,
	seriesPosition: z.number().int().positive().nullable().optional(),
	source: z.enum(["openlibrary", "google", "manual"]).default("manual"),
	status: bookStatusSchema.default("want"),
});
export type CreateBookValues = z.input<typeof createBookSchema>;

// Edit metadata + reading state (manual overrides for OL gaps).
export const updateBookSchema = z.object({
	title: z.string().min(1, "Title required").max(500),
	authors: z.array(z.string()).optional(),
	isbn: optionalText,
	coverUrl: optionalText,
	pageCount: z.number().int().positive().nullable().optional(),
	publishedYear: z.number().int().nullable().optional(),
	description: optionalText,
	genre: optionalText,
	seriesName: optionalText,
	seriesPosition: z.number().int().positive().nullable().optional(),
	rating: z.number().int().min(1).max(RATING_MAX).nullable().optional(),
	review: optionalText,
});
export type UpdateBookValues = z.input<typeof updateBookSchema>;

export const logSessionSchema = z.object({
	date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date"),
	pagesRead: z.number().int().positive("Pages must be positive"),
});
export type LogSessionValues = z.infer<typeof logSessionSchema>;

export const createShelfSchema = z.object({
	name: z.string().min(1, "Name required").max(100),
	color: z.string().optional(),
});
export type CreateShelfValues = z.infer<typeof createShelfSchema>;

export const createQuoteSchema = z.object({
	text: z.string().min(1, "Quote required").max(5000),
	page: z.number().int().positive().nullable().optional(),
});
export type CreateQuoteValues = z.infer<typeof createQuoteSchema>;

export const setGoalSchema = z.object({
	year: z.number().int().min(1900).max(3000),
	targetBooks: z.number().int().min(1).max(10000),
});
export type SetGoalValues = z.infer<typeof setGoalSchema>;
