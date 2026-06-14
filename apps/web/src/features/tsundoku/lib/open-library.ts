// Open Library API helpers — search + cover URLs. No API key, no quota.
// All metadata snapshotted into our DB at add-time (never read at view-time).
import type { BookSearchResult } from "./book-search";

interface OLDoc {
	key?: string;
	title?: string;
	author_name?: string[];
	first_publish_year?: number;
	isbn?: string[];
	cover_i?: number;
	number_of_pages_median?: number;
	subject?: string[];
}

const SEARCH_FIELDS =
	"key,title,author_name,first_publish_year,isbn,cover_i,number_of_pages_median,subject";

export function coverUrlFromId(coverId: number): string {
	return `https://covers.openlibrary.org/b/id/${coverId}-L.jpg`;
}

export function coverUrlFromIsbn(isbn: string): string {
	return `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`;
}

export function buildSearchUrl(query: string, limit = 12): string {
	const params = new URLSearchParams({
		q: query,
		limit: String(limit),
		fields: SEARCH_FIELDS,
	});
	return `https://openlibrary.org/search.json?${params.toString()}`;
}

export function mapDocToResult(doc: OLDoc): BookSearchResult | null {
	if (!doc.key || !doc.title) return null;
	const isbn = doc.isbn?.[0] ?? null;
	const coverUrl = doc.cover_i ? coverUrlFromId(doc.cover_i) : isbn ? coverUrlFromIsbn(isbn) : null;
	return {
		source: "openlibrary",
		externalId: doc.key,
		title: doc.title,
		authors: doc.author_name ?? [],
		isbn,
		coverUrl,
		publishedYear: doc.first_publish_year ?? null,
		pageCount: doc.number_of_pages_median ?? null,
		subjects: (doc.subject ?? []).slice(0, 6),
		description: null, // lazy-fetched on add via fetchWorkDescription
	};
}

export function parseSearchResponse(json: unknown): BookSearchResult[] {
	const docs = (json as { docs?: OLDoc[] })?.docs ?? [];
	return docs.map(mapDocToResult).filter((r): r is BookSearchResult => r !== null);
}

// Work detail (description) — fetched lazily on add if needed.
export function buildWorkUrl(olKey: string): string {
	const key = olKey.startsWith("/") ? olKey : `/${olKey}`;
	return `https://openlibrary.org${key}.json`;
}

export function parseWorkDescription(json: unknown): string | null {
	const desc = (json as { description?: string | { value?: string } })?.description;
	if (!desc) return null;
	return typeof desc === "string" ? desc : (desc.value ?? null);
}
