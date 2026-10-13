import { describe, expect, it } from "vitest";
import {
	type FilterableBook,
	applyFilters,
	byFinishedYear,
	readFilters,
	writeFilters,
} from "./filters";

const book = (over: Partial<FilterableBook>): FilterableBook => ({
	title: "Book",
	authors: ["Ann Author"],
	status: "want",
	rating: null,
	genre: null,
	seriesName: null,
	shelfIds: [],
	position: "a0",
	currentPage: 0,
	pageCount: 300,
	finishedAt: null,
	...over,
});

describe("library filters", () => {
	it("round-trips through the URL and drops bad values", () => {
		const f = readFilters(new URLSearchParams("s=read&rating=8&sort=title&genre=Fantasy&x=1"));
		expect(writeFilters("/tsundoku", f)).toBe("/tsundoku?s=read&genre=Fantasy&rating=8&sort=title");
		expect(readFilters(new URLSearchParams("s=bogus&rating=99&sort=nope"))).toMatchObject({
			segment: null,
			rating: null,
			sort: "added",
		});
	});

	it("puts paused with reading and unfinished with read", () => {
		const books = [
			book({ title: "A", status: "paused" }),
			book({ title: "B", status: "dnf" }),
			book({ title: "C", status: "reading" }),
		];
		const f = readFilters(new URLSearchParams("s=reading"));
		expect(applyFilters(books, f).map((b) => b.title)).toEqual(["A", "C"]);
	});

	it("sorts newest-added by key, not by locale", () => {
		const books = [book({ title: "old", position: "a0" }), book({ title: "new", position: "Zz" })];
		expect(applyFilters(books, readFilters(new URLSearchParams())).map((b) => b.title)).toEqual([
			"new",
			"old",
		]);
	});

	it("keeps books without an author or rating last", () => {
		const books = [book({ title: "none", authors: [] }), book({ title: "ann" })];
		const f = readFilters(new URLSearchParams("sort=author"));
		expect(applyFilters(books, f).map((b) => b.title)).toEqual(["ann", "none"]);
	});

	it("searches titles, authors and series", () => {
		const books = [book({ title: "Dune", seriesName: "Arrakis" }), book({ title: "Other" })];
		expect(applyFilters(books, readFilters(new URLSearchParams("q=arra")))).toHaveLength(1);
	});

	it("groups read books by year", () => {
		const groups = byFinishedYear([
			book({ title: "a", finishedAt: "2025-03-01" }),
			book({ title: "b", finishedAt: "2026-01-01" }),
		]);
		expect(groups.map(([y]) => y)).toEqual(["2026", "2025"]);
	});
});
