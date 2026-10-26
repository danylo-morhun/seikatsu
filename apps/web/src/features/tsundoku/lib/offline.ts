// Tsundoku's offline-capable mutations and their overlay: run the action or queue it when
// there's no connection; overlayBooks shows queued ones on the list and the book page.

import type { OfflineOps, Op } from "@/features/pwa/lib/ops";
import { runOrQueue } from "@/features/pwa/lib/run";
import { setProgress, updateRating, updateStatus } from "@/features/tsundoku/actions/books";
import { logSession } from "@/features/tsundoku/actions/sessions";
import type { BookStatus } from "@/features/tsundoku/lib/constants";
import { type ProgressState, progressPatch, statusPatch } from "@/features/tsundoku/lib/progress";

/** The device's calendar day — what "today" was when an offline change was made. */
function localDay() {
	const d = new Date();
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const quote = (title: string) => `“${title.length > 40 ? `${title.slice(0, 40)}…` : title}”`;

export function saveProgress(book: { id: string; title: string }, currentPage: number) {
	const args = { bookId: book.id, currentPage, asOf: localDay() };
	return runOrQueue(
		"tsundoku.setProgress",
		args,
		`${quote(book.title)} · page ${currentPage}`,
		() => setProgress(book.id, { currentPage, asOf: args.asOf }),
	);
}

export function setBookStatus(book: { id: string; title: string }, status: BookStatus) {
	return runOrQueue(
		"tsundoku.updateStatus",
		{ bookId: book.id, status },
		`${quote(book.title)} · ${status}`,
		() => updateStatus(book.id, status),
	);
}

export function rateBook(book: { id: string; title: string }, rating: number | null) {
	return runOrQueue(
		"tsundoku.updateRating",
		{ bookId: book.id, rating },
		`${quote(book.title)} · ${rating ? `rated ${rating / 2}★` : "rating cleared"}`,
		() => updateRating(book.id, rating),
	);
}

/** A reading day. Its id is made here so a replay lands once. */
export function logDay(
	book: { id: string; title: string },
	values: { date: string; pagesRead: number },
) {
	const args = { bookId: book.id, id: crypto.randomUUID(), ...values };
	return runOrQueue(
		"tsundoku.logSession",
		args,
		`${quote(book.title)} · ${values.pagesRead} pages on ${values.date}`,
		() => logSession(book.id, { id: args.id, ...values }),
	);
}

/** Books after the queued changes — the same patches the server applies. */
export function overlayBooks<T extends ProgressState & { id: string; rating: number | null }>(
	books: T[],
	ops: Op[],
): T[] {
	if (ops.length === 0) return books;
	return books.map((book) => {
		let b = book;
		for (const op of ops) {
			if ((op.args as { bookId?: string }).bookId !== book.id) continue;
			if (op.name === "tsundoku.setProgress") {
				const a = op.args as OfflineOps["tsundoku.setProgress"];
				b = { ...b, ...progressPatch(b, a.currentPage, a.asOf) };
			}
			if (op.name === "tsundoku.updateStatus") {
				const a = op.args as OfflineOps["tsundoku.updateStatus"];
				if (b.status !== a.status) b = { ...b, ...statusPatch(b, a.status, localDay()) };
			}
			if (op.name === "tsundoku.updateRating") {
				b = { ...b, rating: (op.args as OfflineOps["tsundoku.updateRating"]).rating };
			}
			if (op.name === "tsundoku.logSession") {
				const a = op.args as OfflineOps["tsundoku.logSession"];
				b = { ...b, ...progressPatch(b, b.currentPage + a.pagesRead, a.date) };
			}
		}
		return b;
	});
}
