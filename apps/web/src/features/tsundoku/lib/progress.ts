// Reading progress rules shared by every action that moves `currentPage`. Pure: the actions
// pass the book's state and the user's calendar day, and write the patch they get back.

import type { BookStatus } from "./constants";

export interface ProgressState {
	status: BookStatus;
	currentPage: number;
	pageCount: number | null;
	startedAt: string | null;
	finishedAt: string | null;
}

export type ProgressPatch = Partial<ProgressState>;

export function clampPage(page: number, pageCount: number | null): number {
	const floor = Math.max(0, Math.round(page));
	return pageCount ? Math.min(floor, pageCount) : floor;
}

/**
 * The patch for moving to `nextPage`. Reading forward starts a want/paused book; reaching the
 * last page finishes it; going back below the end of a finished book reopens it.
 */
export function progressPatch(book: ProgressState, nextPage: number, today: string): ProgressPatch {
	const page = clampPage(nextPage, book.pageCount);
	const patch: ProgressPatch = { currentPage: page };
	const done = book.pageCount != null && page >= book.pageCount;

	if (done) {
		if (book.status !== "read") {
			patch.status = "read";
			patch.finishedAt = today;
		}
		if (!book.startedAt) patch.startedAt = today;
	} else if (book.status === "read" && page < book.currentPage) {
		patch.status = "reading";
		patch.finishedAt = null;
	} else if (page > book.currentPage && (book.status === "want" || book.status === "paused")) {
		patch.status = "reading";
		if (!book.startedAt) patch.startedAt = today;
	}
	return patch;
}

/** The patch for setting a status by hand: dates follow, finishing fills the progress. */
export function statusPatch(book: ProgressState, next: BookStatus, today: string): ProgressPatch {
	const patch: ProgressPatch = { status: next };
	if (next === "reading" && !book.startedAt) patch.startedAt = today;
	if (next === "read") {
		if (!book.finishedAt) patch.finishedAt = today;
		if (!book.startedAt) patch.startedAt = today;
		if (book.pageCount && book.currentPage < book.pageCount) patch.currentPage = book.pageCount;
	}
	if (next !== "read" && book.finishedAt) patch.finishedAt = null;
	return patch;
}

/** "140" is a page, "45%" a share of `pageCount`. Null when it can't be read. */
export function parseProgressInput(raw: string, pageCount: number | null): number | null {
	const value = raw.trim().replace(",", ".");
	const percent = value.match(/^(\d+(?:\.\d+)?)\s*%$/);
	if (percent) {
		if (!pageCount) return null;
		const share = Number(percent[1]);
		if (share > 100) return null;
		return Math.round((share / 100) * pageCount);
	}
	if (!/^\d+$/.test(value)) return null;
	return Number(value);
}
