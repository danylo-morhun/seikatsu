import { describe, expect, it } from "vitest";
import { genreFromSubjects } from "./genre";
import {
	type ProgressState,
	finishDatePatch,
	pageCountPatch,
	pagesLeft,
	parseProgressInput,
	progressPatch,
	sessionEditPatch,
	statusPatch,
} from "./progress";
import { computeStreaks } from "./streak";

const TODAY = "2026-10-13";
const book = (over: Partial<ProgressState> = {}): ProgressState => ({
	status: "reading",
	currentPage: 100,
	pageCount: 300,
	startedAt: "2026-10-01",
	finishedAt: null,
	...over,
});

describe("progressPatch", () => {
	it("starts a want book on the first pages", () => {
		expect(
			progressPatch(book({ status: "want", currentPage: 0, startedAt: null }), 20, TODAY),
		).toEqual({ currentPage: 20, status: "reading", startedAt: TODAY });
	});

	it("finishes at the last page and clamps past it", () => {
		expect(progressPatch(book(), 400, TODAY)).toEqual({
			currentPage: 300,
			status: "read",
			finishedAt: TODAY,
		});
	});

	it("reopens a finished book when progress goes back", () => {
		const read = book({ status: "read", currentPage: 300, finishedAt: "2026-10-10" });
		expect(progressPatch(read, 250, TODAY)).toEqual({
			currentPage: 250,
			status: "reading",
			finishedAt: null,
		});
	});

	it("leaves a book reopened at its last page open", () => {
		expect(progressPatch(book({ currentPage: 300 }), 300, TODAY)).toEqual({ currentPage: 300 });
	});

	it("never goes below zero", () => {
		expect(progressPatch(book(), -5, TODAY).currentPage).toBe(0);
	});
});

describe("statusPatch", () => {
	it("marking read fills progress and the finish, not the start", () => {
		expect(statusPatch(book({ startedAt: null }), "read", TODAY)).toEqual({
			status: "read",
			finishedAt: TODAY,
			currentPage: 300,
		});
	});

	it("leaving read clears finishedAt", () => {
		expect(
			statusPatch(book({ status: "read", finishedAt: "2026-10-10" }), "reading", TODAY),
		).toEqual({ status: "reading", finishedAt: null });
	});
});

describe("pageCountPatch", () => {
	it("keeps a finished book finished at its new length", () => {
		expect(pageCountPatch(book({ status: "read", currentPage: 10 }), 80)).toEqual({
			currentPage: 80,
		});
	});

	it("keeps progress inside a shorter book without finishing it", () => {
		expect(pageCountPatch(book({ currentPage: 250 }), 200)).toEqual({ currentPage: 200 });
	});
});

describe("pagesLeft", () => {
	it("caps a session at the pages not yet logged", () => {
		expect(pagesLeft(50, 8, 100)).toBe(42);
		expect(pagesLeft(50, 60, 10)).toBe(0);
		expect(pagesLeft(null, 8, 100)).toBe(100);
	});
});

describe("parseProgressInput", () => {
	it("reads pages and percents", () => {
		expect(parseProgressInput("140", 300)).toBe(140);
		expect(parseProgressInput("45%", 300)).toBe(135);
		expect(parseProgressInput("12,5 %", 200)).toBe(25);
	});

	it("rejects what it can't read", () => {
		expect(parseProgressInput("45%", null)).toBeNull();
		expect(parseProgressInput("abc", 300)).toBeNull();
		expect(parseProgressInput("120%", 300)).toBeNull();
	});
});

describe("computeStreaks", () => {
	it("counts a streak that runs to yesterday", () => {
		const days = ["2026-10-10", "2026-10-11", "2026-10-12", "2026-10-01"];
		expect(computeStreaks(days, TODAY)).toEqual({ current: 3, longest: 3 });
	});

	it("is broken by a missed day", () => {
		expect(computeStreaks(["2026-10-11"], TODAY)).toEqual({ current: 0, longest: 1 });
	});
});

describe("genreFromSubjects", () => {
	it("prefers the specific genre", () => {
		expect(genreFromSubjects(["Fiction", "Science fiction, American"])).toBe("Sci-fi");
		expect(genreFromSubjects(["Fiction, general"])).toBe("Fiction");
		expect(genreFromSubjects([])).toBeUndefined();
		expect(genreFromSubjects(["Historical fiction", "History"])).toBe("Fiction");
		expect(genreFromSubjects(["Magic realism"])).toBe("Fiction");
		expect(genreFromSubjects(["Comic novels", "War"])).toBe("Fiction");
	});
});

describe("sessionEditPatch", () => {
	const LOGGED = 100;
	const day = (date: string, pagesRead: number) => ({ date, pagesRead });

	it("moves only the date when pages stay", () => {
		expect(
			sessionEditPatch(book(), LOGGED, day("2026-10-10", 20), day("2026-10-08", 20), TODAY),
		).toEqual({
			pagesRead: 20,
			patch: { currentPage: 100 },
		});
	});

	it("moves the start back to an earlier day", () => {
		expect(
			sessionEditPatch(book(), LOGGED, day("2026-10-01", 20), day("2026-09-28", 20), TODAY).patch,
		).toEqual({ currentPage: 100, startedAt: "2026-09-28" });
	});

	it("takes pages back when fewer were read", () => {
		expect(
			sessionEditPatch(book(), LOGGED, day("2026-10-10", 30), day("2026-10-10", 10), TODAY),
		).toEqual({
			pagesRead: 10,
			patch: { currentPage: 80 },
		});
	});

	it("never reads past the last page and finishes on that day", () => {
		expect(
			sessionEditPatch(
				book({ currentPage: 290 }),
				290,
				day("2026-10-10", 10),
				day("2026-10-11", 50),
				TODAY,
			),
		).toEqual({
			pagesRead: 20,
			patch: { currentPage: 300, status: "read", finishedAt: "2026-10-11" },
		});
	});

	it("carries the finish to the new day", () => {
		const read = book({ status: "read", currentPage: 300, finishedAt: "2026-10-10" });
		expect(
			sessionEditPatch(read, LOGGED, day("2026-10-10", 40), day("2026-10-09", 40), TODAY).patch,
		).toEqual({ currentPage: 300, finishedAt: "2026-10-09" });
	});

	it("reopens a finished book when its pages shrink", () => {
		const read = book({ status: "read", currentPage: 300, finishedAt: "2026-10-10" });
		expect(
			sessionEditPatch(read, LOGGED, day("2026-10-10", 40), day("2026-10-10", 30), TODAY).patch,
		).toEqual({ currentPage: 290, status: "reading", finishedAt: null });
	});

	it("grows a day of a book finished by hand", () => {
		const read = book({ status: "read", currentPage: 300, finishedAt: "2026-10-10" });
		expect(
			sessionEditPatch(read, 40, day("2026-10-10", 40), day("2026-10-10", 300), TODAY),
		).toEqual({ pagesRead: 300, patch: { currentPage: 300, finishedAt: "2026-10-10" } });
	});
});

describe("finishDatePatch", () => {
	it("moves the finish and keeps the start before it", () => {
		expect(finishDatePatch(book(), "2026-10-05")).toEqual({ finishedAt: "2026-10-05" });
		expect(finishDatePatch(book(), "2026-09-20")).toEqual({
			finishedAt: "2026-09-20",
			startedAt: "2026-09-20",
		});
	});
});
