import { z } from "zod";
import { page } from "@/features/mcp/lib/compact";
import {
	getBook,
	getBooks,
	setProgress,
	updateRating,
	updateStatus,
} from "@/features/tsundoku/actions/books";
import { createQuote, getQuotes } from "@/features/tsundoku/actions/quotes";
import { getSessions, logSession } from "@/features/tsundoku/actions/sessions";
import { getShelvesWithCounts } from "@/features/tsundoku/actions/shelves";
import { getYearStats } from "@/features/tsundoku/actions/stats";
import { BOOK_STATUSES, RATING_MAX } from "@/features/tsundoku/lib/constants";
import { day } from "./shell";
import { tool } from "./types";

const id = z.uuid();

export const tsundokuTools = [
	tool({
		name: "tsundoku_books",
		title: "Tsundoku books",
		description: `The library: title, authors, status (${BOOK_STATUSES.join(", ")}), current page / page count, rating, days to finish at the current pace. Filters: status, shelfId (tsundoku_shelves), q (title/author). 100 per page.`,
		input: {
			status: z.enum(BOOK_STATUSES).optional(),
			shelfId: id.optional(),
			q: z.string().max(200).optional(),
			offset: z.number().int().min(0).default(0),
		},
		run: async ({ status, shelfId, q, offset }) => {
			const needle = q?.toLowerCase();
			const books = (await getBooks())
				.filter((b) => !status || b.status === status)
				.filter((b) => !shelfId || b.shelfIds.includes(shelfId))
				.filter(
					(b) =>
						!needle ||
						b.title.toLowerCase().includes(needle) ||
						(b.authors ?? []).some((a) => a.toLowerCase().includes(needle)),
				)
				.map(({ coverUrl, coverBlob, position, createdAt, ...b }) => b);
			return page(books, offset, 100);
		},
	}),
	tool({
		name: "tsundoku_book",
		title: "Tsundoku book",
		description: "One book in full, with its reading sessions (date, pages) and quotes.",
		input: { bookId: id },
		run: async ({ bookId }) => {
			const book = await getBook(bookId);
			if (!book) return { error: "Book not found" };
			const [sessions, quotes] = await Promise.all([getSessions(bookId), getQuotes(bookId)]);
			const { coverUrl, coverBlob, ...rest } = book;
			return {
				...rest,
				sessions: sessions.map((s) => ({ date: s.date, pages: s.pagesRead })),
				quotes: quotes.map((q) => ({ text: q.text, page: q.page })),
			};
		},
	}),
	tool({
		name: "tsundoku_shelves",
		title: "Tsundoku shelves",
		description: "Shelves with ids and how many books each holds.",
		input: {},
		run: () => getShelvesWithCounts(),
	}),
	tool({
		name: "tsundoku_year",
		title: "Tsundoku year",
		description:
			"A year of reading: books finished, pages, pace, the yearly goal, best days, genres.",
		input: { year: z.number().int().min(1900).max(3000).optional() },
		run: ({ year }, { today }) => getYearStats(year ?? Number(today.slice(0, 4))),
	}),
	tool({
		name: "tsundoku_log_pages",
		title: "Log pages read",
		description:
			"Log reading: either `pages` read on `date` (default today), or `toPage` = the page the user is on now. Moves the book's progress and ticks a habit that follows reading, as in the app. Pass a fresh requestId (uuid) with `pages` so a retry lands once.",
		input: {
			bookId: id,
			pages: z.number().int().positive().max(5000).optional(),
			toPage: z.number().int().min(0).max(100_000).optional(),
			date: day.optional(),
			requestId: id.optional(),
		},
		write: true,
		run: async ({ bookId, pages, toPage, date, requestId }, { today }) => {
			if (toPage !== undefined) return setProgress(bookId, { currentPage: toPage, asOf: date });
			if (pages === undefined) return { error: "Give pages or toPage" };
			return logSession(bookId, { id: requestId, date: date ?? today, pagesRead: pages });
		},
	}),
	tool({
		name: "tsundoku_set_status",
		title: "Set a book's status",
		description: `Set a book's status: ${BOOK_STATUSES.join(", ")} (reading sets the start day, read the finish day, as in the app).`,
		input: { bookId: id, status: z.enum(BOOK_STATUSES) },
		write: true,
		idempotent: true,
		run: ({ bookId, status }) => updateStatus(bookId, status),
	}),
	tool({
		name: "tsundoku_rate",
		title: "Rate a book",
		description: `Rate a book 1–${RATING_MAX}, or null to clear.`,
		input: { bookId: id, rating: z.number().min(0).max(RATING_MAX).nullable() },
		write: true,
		idempotent: true,
		run: ({ bookId, rating }) => updateRating(bookId, rating),
	}),
	tool({
		name: "tsundoku_add_quote",
		title: "Save a quote",
		description: "Save a quote from a book, with its page if known.",
		input: {
			bookId: id,
			text: z.string().min(1).max(5000),
			page: z.number().int().positive().optional(),
		},
		write: true,
		run: ({ bookId, text, page: p }) => createQuote(bookId, { text, page: p ?? null }),
	}),
];
