import type { Op, OpName } from "@/features/pwa/lib/ops";
import { describe, expect, it, vi } from "vitest";

// The overlay is pure; the server actions it sits beside never run here.
vi.mock("@/features/tsundoku/actions/books", () => ({}));
vi.mock("@/features/tsundoku/actions/sessions", () => ({}));
const { overlayBooks } = await import("./offline");

let n = 0;
function op<N extends OpName>(name: N, args: Op<N>["args"]): Op {
	return { opId: `op${n++}`, name, args, label: "", createdAt: n, status: "pending" } as Op;
}

const book = {
	id: "b1",
	status: "want" as const,
	currentPage: 0,
	pageCount: 300,
	startedAt: null,
	finishedAt: null,
	rating: null,
};

describe("overlayBooks", () => {
	it("applies queued progress, logged days and ratings with the server's patches", () => {
		const [b] = overlayBooks(
			[book],
			[
				op("tsundoku.setProgress", { bookId: "b1", currentPage: 40, asOf: "2026-10-24" }),
				op("tsundoku.logSession", { bookId: "b1", id: "s", date: "2026-10-25", pagesRead: 10 }),
				op("tsundoku.updateRating", { bookId: "b1", rating: 8 }),
			],
		);
		expect(b).toMatchObject({
			status: "reading",
			currentPage: 50,
			startedAt: "2026-10-24",
			rating: 8,
		});
	});

	it("leaves other books and an empty queue alone", () => {
		const list = [book];
		expect(overlayBooks(list, [])).toBe(list);
		expect(
			overlayBooks(list, [op("tsundoku.updateRating", { bookId: "other", rating: 2 })])[0],
		).toEqual(book);
	});
});
