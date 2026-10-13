"use server";

import { requireWorkspace } from "@/features/tsundoku/actions/guard";
import { computeStreaks, daysBetween } from "@/features/tsundoku/lib/streak";
import { getUserToday } from "@/lib/timezone";
import { db, eq, sum, tsundokuBooks, tsundokuSessions } from "@seikatsu/db";

export interface YearBook {
	id: string;
	title: string;
	authors: string[] | null;
	coverUrl: string | null;
	coverBlob: string | null;
	rating: number | null;
	pageCount: number | null;
	finishedAt: string;
	days: number | null;
}

export interface ReadingDay {
	date: string;
	pages: number;
}

export interface YearStats {
	year: number;
	/** Years with any finished book or session, newest first (always includes this year). */
	years: number[];
	/** Books finished this year, newest first. */
	finished: YearBook[];
	/** Pages of the books finished this year (sessions are optional, so not the logged pages). */
	pages: number;
	avgRating: number | null;
	/** Logged pages per month, Jan..Dec. */
	months: number[];
	/** Books finished per month, Jan..Dec. */
	monthBooks: number[];
	/** Days read this year, ascending. */
	days: ReadingDay[];
	streak: { current: number; longest: number };
	longest: YearBook | null;
	shortest: YearBook | null;
	fastest: YearBook | null;
	counts: { reading: number; want: number; read: number; dnf: number; paused: number };
	pagesAllTime: number;
}

export async function getYearStats(year: number): Promise<YearStats> {
	const workspace = await requireWorkspace();
	const [books, daily, today] = await Promise.all([
		db
			.select({
				id: tsundokuBooks.id,
				title: tsundokuBooks.title,
				authors: tsundokuBooks.authors,
				coverUrl: tsundokuBooks.coverUrl,
				coverBlob: tsundokuBooks.coverBlob,
				rating: tsundokuBooks.rating,
				pageCount: tsundokuBooks.pageCount,
				status: tsundokuBooks.status,
				startedAt: tsundokuBooks.startedAt,
				finishedAt: tsundokuBooks.finishedAt,
			})
			.from(tsundokuBooks)
			.where(eq(tsundokuBooks.workspaceId, workspace.id)),
		db
			.select({
				date: tsundokuSessions.date,
				pages: sum(tsundokuSessions.pagesRead).mapWith(Number),
			})
			.from(tsundokuSessions)
			.innerJoin(tsundokuBooks, eq(tsundokuBooks.id, tsundokuSessions.bookId))
			.where(eq(tsundokuBooks.workspaceId, workspace.id))
			.groupBy(tsundokuSessions.date)
			.orderBy(tsundokuSessions.date),
		getUserToday(),
	]);

	const prefix = String(year);
	const counts = { reading: 0, want: 0, read: 0, dnf: 0, paused: 0 };
	const years = new Set([Number(today.slice(0, 4))]);
	const finished: YearBook[] = [];
	for (const b of books) {
		counts[b.status]++;
		if (b.status !== "read" || !b.finishedAt) continue;
		years.add(Number(b.finishedAt.slice(0, 4)));
		if (!b.finishedAt.startsWith(prefix)) continue;
		finished.push({
			id: b.id,
			title: b.title,
			authors: b.authors,
			coverUrl: b.coverUrl,
			coverBlob: b.coverBlob,
			rating: b.rating,
			pageCount: b.pageCount,
			finishedAt: b.finishedAt,
			days: b.startedAt ? daysBetween(b.startedAt, b.finishedAt) + 1 : null,
		});
	}
	finished.sort((a, b) => b.finishedAt.localeCompare(a.finishedAt));

	const months = Array.from({ length: 12 }, () => 0);
	const days: ReadingDay[] = [];
	let pagesAllTime = 0;
	for (const d of daily) {
		pagesAllTime += d.pages;
		years.add(Number(d.date.slice(0, 4)));
		if (!d.date.startsWith(prefix)) continue;
		months[Number(d.date.slice(5, 7)) - 1] += d.pages;
		days.push(d);
	}

	const monthBooks = Array.from({ length: 12 }, () => 0);
	for (const b of finished) monthBooks[Number(b.finishedAt.slice(5, 7)) - 1]++;

	const rated = finished.filter((b) => b.rating != null);
	const paged = finished.filter((b) => b.pageCount != null);
	const timed = finished.filter((b) => b.days != null);
	const pick = (list: YearBook[], better: (a: YearBook, b: YearBook) => boolean) =>
		list.reduce<YearBook | null>((best, b) => (best == null || better(b, best) ? b : best), null);
	const longest = pick(paged, (a, b) => (a.pageCount ?? 0) > (b.pageCount ?? 0));
	const shortest = pick(paged, (a, b) => (a.pageCount ?? 0) < (b.pageCount ?? 0));

	return {
		year,
		years: [...years].sort((a, b) => b - a),
		finished,
		pages: paged.reduce((s, b) => s + (b.pageCount ?? 0), 0),
		avgRating:
			rated.length > 0
				? Math.round((rated.reduce((s, b) => s + (b.rating ?? 0), 0) / rated.length) * 10) / 10
				: null,
		months,
		monthBooks,
		days,
		streak: computeStreaks(
			daily.map((d) => d.date),
			today,
		),
		longest,
		// Books of one length have no shortest: it would repeat the longest.
		shortest: shortest && shortest.pageCount !== longest?.pageCount ? shortest : null,
		fastest: pick(timed, (a, b) => (a.days ?? 0) < (b.days ?? 0)),
		counts,
		pagesAllTime,
	};
}
