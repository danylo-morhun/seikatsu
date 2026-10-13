// The library's URL filters and sorts. Pure: LibraryView reads the params, these apply them.

import { type BookStatus, SEGMENTS, type Segment } from "./constants";

export interface FilterableBook {
	title: string;
	authors: string[] | null;
	status: BookStatus;
	rating: number | null;
	genre: string | null;
	seriesName: string | null;
	shelfIds: string[];
	position: string;
	currentPage: number;
	pageCount: number | null;
	finishedAt: string | null;
}

export const SORTS = [
	{ value: "added", label: "Recently added" },
	{ value: "title", label: "Title" },
	{ value: "author", label: "Author" },
	{ value: "rating", label: "Rating" },
	{ value: "finished", label: "Date finished" },
] as const;
export type Sort = (typeof SORTS)[number]["value"];

export interface LibraryFilters {
	segment: Segment | null;
	q: string;
	genre: string | null;
	shelf: string | null;
	series: string | null;
	author: string | null;
	/** Lowest rating shown, 1–10 (stars × 2). */
	rating: number | null;
	sort: Sort;
}

const SEGMENT_VALUES = new Set<string>(SEGMENTS.map((s) => s.value));
const SORT_VALUES = new Set<string>(SORTS.map((s) => s.value));

export function readFilters(params: URLSearchParams): LibraryFilters {
	const segment = params.get("s");
	const sort = params.get("sort");
	const rating = Number(params.get("rating"));
	return {
		segment: segment && SEGMENT_VALUES.has(segment) ? (segment as Segment) : null,
		q: (params.get("q") ?? "").trim(),
		genre: params.get("genre") || null,
		shelf: params.get("shelf") || null,
		series: params.get("series") || null,
		author: params.get("author") || null,
		rating: Number.isInteger(rating) && rating >= 1 && rating <= 10 ? rating : null,
		sort: sort && SORT_VALUES.has(sort) ? (sort as Sort) : "added",
	};
}

/** The URL for these filters (defaults left out, so a clean library is a clean URL). */
export function writeFilters(pathname: string, f: LibraryFilters): string {
	const params = new URLSearchParams();
	if (f.segment) params.set("s", f.segment);
	if (f.q) params.set("q", f.q);
	if (f.genre) params.set("genre", f.genre);
	if (f.shelf) params.set("shelf", f.shelf);
	if (f.series) params.set("series", f.series);
	if (f.author) params.set("author", f.author);
	if (f.rating) params.set("rating", String(f.rating));
	if (f.sort !== "added") params.set("sort", f.sort);
	const qs = params.toString();
	return qs ? `${pathname}?${qs}` : pathname;
}

/** Filters beyond the segment and the search box (the Filter menu's count). */
export function menuFilterCount(f: LibraryFilters): number {
	return [f.genre, f.shelf, f.series, f.author, f.rating].filter((v) => v != null).length;
}

export function segmentOf(status: BookStatus): Segment {
	return (
		SEGMENTS.find((s) => (s.statuses as readonly BookStatus[]).includes(status))?.value ?? "pile"
	);
}

// Fractional-index keys compare by code unit ("Zz" < "a0"); localeCompare would not.
const byKey = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const text = (s: string | null | undefined) => (s ?? "").toLocaleLowerCase();

export function applyFilters<T extends FilterableBook>(books: T[], f: LibraryFilters): T[] {
	const q = text(f.q);
	const out = books.filter(
		(b) =>
			(!f.segment || segmentOf(b.status) === f.segment) &&
			(!f.genre || b.genre === f.genre) &&
			(!f.shelf || b.shelfIds.includes(f.shelf)) &&
			(!f.series || b.seriesName === f.series) &&
			(!f.author || (b.authors ?? []).includes(f.author)) &&
			(!f.rating || (b.rating ?? 0) >= f.rating) &&
			(!q ||
				text(b.title).includes(q) ||
				(b.authors ?? []).some((a) => text(a).includes(q)) ||
				text(b.seriesName).includes(q)),
	);
	return sortBooks(out, f.sort);
}

export function sortBooks<T extends FilterableBook>(books: T[], sort: Sort): T[] {
	const sorted = [...books];
	// Missing values go last whichever way a column sorts.
	const last = (a: unknown, b: unknown) => (a == null ? 1 : 0) - (b == null ? 1 : 0);
	sorted.sort((a, b) => {
		switch (sort) {
			case "title":
				return a.title.localeCompare(b.title);
			case "author": {
				const [x, y] = [a.authors?.[0], b.authors?.[0]];
				return last(x, y) || (x ?? "").localeCompare(y ?? "");
			}
			case "rating":
				return last(a.rating, b.rating) || (b.rating ?? 0) - (a.rating ?? 0);
			case "finished":
				return last(a.finishedAt, b.finishedAt) || byKey(b.finishedAt ?? "", a.finishedAt ?? "");
			default:
				return byKey(a.position, b.position);
		}
	});
	return sorted;
}

/** Read books by the year they were finished, newest year first (undated last). */
export function byFinishedYear<T extends FilterableBook>(books: T[]): [string, T[]][] {
	const groups = new Map<string, T[]>();
	for (const b of sortBooks(books, "finished")) {
		const year = b.finishedAt?.slice(0, 4) ?? "Earlier";
		const group = groups.get(year);
		if (group) group.push(b);
		else groups.set(year, [b]);
	}
	return [...groups.entries()];
}
