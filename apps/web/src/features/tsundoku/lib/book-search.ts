// Shared search-result shape across providers (Open Library + Google Books),
// plus dedupe/merge so the same book from two sources collapses into one row.

export type BookSource = "openlibrary" | "google";

export interface BookSearchResult {
	source: BookSource;
	externalId: string; // OL work key or Google volume id
	title: string;
	authors: string[];
	isbn: string | null;
	coverUrl: string | null;
	publishedYear: number | null;
	pageCount: number | null;
	subjects: string[];
	description: string | null; // Google returns inline; OL is lazy-fetched on add
}

function norm(s: string): string {
	return s
		.toLowerCase()
		.normalize("NFKD")
		.replace(/[^a-z0-9]/g, "");
}

function dedupeKey(r: BookSearchResult): string {
	const isbn = r.isbn?.replace(/[^0-9Xx]/g, "");
	if (isbn) return `isbn:${isbn}`;
	return `t:${norm(r.title)}|a:${norm(r.authors[0] ?? "")}`;
}

/** Pick the richer of two duplicates as base, then backfill missing fields from the other. */
function merge(a: BookSearchResult, b: BookSearchResult): BookSearchResult {
	const base = a.coverUrl ? a : b.coverUrl ? b : a;
	const other = base === a ? b : a;
	return {
		...base,
		isbn: base.isbn ?? other.isbn,
		coverUrl: base.coverUrl ?? other.coverUrl,
		publishedYear: base.publishedYear ?? other.publishedYear,
		pageCount: base.pageCount ?? other.pageCount,
		description: base.description ?? other.description,
		subjects: base.subjects.length ? base.subjects : other.subjects,
	};
}

/**
 * Merge results from multiple providers. Same book (by ISBN, else title+author)
 * collapses into one entry; results with covers float to the top.
 */
export function dedupeResults(results: BookSearchResult[]): BookSearchResult[] {
	const map = new Map<string, BookSearchResult>();
	for (const r of results) {
		const key = dedupeKey(r);
		const cur = map.get(key);
		map.set(key, cur ? merge(cur, r) : r);
	}
	return [...map.values()].sort(
		(a, b) => Number(Boolean(b.coverUrl)) - Number(Boolean(a.coverUrl)),
	);
}
