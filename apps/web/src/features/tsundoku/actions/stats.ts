"use server";

import { getOwnedWorkspace } from "@/features/tsundoku/actions/guard";
import { and, db, eq, gte, lte, sql, tsundokuBooks, tsundokuSessions } from "@seikatsu/db";

export interface GenreSlice {
	genre: string;
	count: number;
}
export interface MonthPages {
	month: string; // YYYY-MM
	pages: number;
}
export interface TsundokuStats {
	totalBooks: number;
	readCount: number;
	readingCount: number;
	wantCount: number;
	booksReadThisYear: number;
	pagesThisYear: number;
	pagesAllTime: number;
	avgRating: number | null;
	longestBook: { title: string; pageCount: number } | null;
	fastestRead: { title: string; days: number } | null;
	genres: GenreSlice[];
	pagesByMonth: MonthPages[];
}

function daysBetween(start: string, end: string): number {
	return Math.max(
		0,
		Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86_400_000),
	);
}

export async function getStats(workspaceId: string, year: number): Promise<TsundokuStats | null> {
	const ws = await getOwnedWorkspace(workspaceId);
	if (!ws) return null;

	const books = await db
		.select({
			title: tsundokuBooks.title,
			status: tsundokuBooks.status,
			rating: tsundokuBooks.rating,
			pageCount: tsundokuBooks.pageCount,
			genre: tsundokuBooks.genre,
			startedAt: tsundokuBooks.startedAt,
			finishedAt: tsundokuBooks.finishedAt,
		})
		.from(tsundokuBooks)
		.where(eq(tsundokuBooks.workspaceId, workspaceId));

	let readCount = 0;
	let readingCount = 0;
	let wantCount = 0;
	let booksReadThisYear = 0;
	let ratingSum = 0;
	let ratingN = 0;
	let longestBook: TsundokuStats["longestBook"] = null;
	let fastestRead: TsundokuStats["fastestRead"] = null;
	const genreMap = new Map<string, number>();
	const yearStr = String(year);

	for (const b of books) {
		if (b.status === "read") readCount++;
		else if (b.status === "reading") readingCount++;
		else if (b.status === "want") wantCount++;

		if (b.finishedAt?.startsWith(yearStr)) booksReadThisYear++;
		if (b.rating != null) {
			ratingSum += b.rating;
			ratingN++;
		}
		if (b.genre) genreMap.set(b.genre, (genreMap.get(b.genre) ?? 0) + 1);
		if (b.pageCount && (!longestBook || b.pageCount > longestBook.pageCount)) {
			longestBook = { title: b.title, pageCount: b.pageCount };
		}
		if (b.status === "read" && b.startedAt && b.finishedAt) {
			const days = daysBetween(b.startedAt, b.finishedAt);
			if (!fastestRead || days < fastestRead.days) fastestRead = { title: b.title, days };
		}
	}

	// Pages per month for the chosen year + all-time total.
	const monthRows = await db
		.select({
			month: sql<string>`to_char(${tsundokuSessions.date}::date, 'YYYY-MM')`,
			pages: sql<number>`sum(${tsundokuSessions.pagesRead})::int`,
		})
		.from(tsundokuSessions)
		.innerJoin(tsundokuBooks, eq(tsundokuSessions.bookId, tsundokuBooks.id))
		.where(
			and(
				eq(tsundokuBooks.workspaceId, workspaceId),
				gte(tsundokuSessions.date, `${year}-01-01`),
				lte(tsundokuSessions.date, `${year}-12-31`),
			),
		)
		.groupBy(sql`to_char(${tsundokuSessions.date}::date, 'YYYY-MM')`);

	const [allTime] = await db
		.select({ pages: sql<number>`coalesce(sum(${tsundokuSessions.pagesRead}), 0)::int` })
		.from(tsundokuSessions)
		.innerJoin(tsundokuBooks, eq(tsundokuSessions.bookId, tsundokuBooks.id))
		.where(eq(tsundokuBooks.workspaceId, workspaceId));

	const pagesByMonth = Array.from({ length: 12 }, (_, i) => {
		const month = `${year}-${String(i + 1).padStart(2, "0")}`;
		const found = monthRows.find((r) => r.month === month);
		return { month, pages: found ? Number(found.pages) : 0 };
	});
	const pagesThisYear = pagesByMonth.reduce((s, m) => s + m.pages, 0);

	const genres = Array.from(genreMap.entries())
		.map(([genre, count]) => ({ genre, count }))
		.sort((a, b) => b.count - a.count);

	return {
		totalBooks: books.length,
		readCount,
		readingCount,
		wantCount,
		booksReadThisYear,
		pagesThisYear,
		pagesAllTime: Number(allTime?.pages ?? 0),
		avgRating: ratingN > 0 ? Math.round((ratingSum / ratingN) * 10) / 10 : null,
		longestBook,
		fastestRead,
		genres,
		pagesByMonth,
	};
}
