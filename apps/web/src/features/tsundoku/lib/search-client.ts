import type { BookSearchResult } from "./book-search";

export type SearchResponse = { error: string } | { results: BookSearchResult[] };

/** The add dialog's search; aborted when the query changes. */
export async function searchBooks(query: string, signal?: AbortSignal): Promise<SearchResponse> {
	try {
		const res = await fetch(`/api/tsundoku/search?q=${encodeURIComponent(query)}`, { signal });
		const body = (await res.json()) as SearchResponse;
		return res.ok || "error" in body ? body : { error: "Search failed" };
	} catch (e) {
		if (signal?.aborted) throw e;
		return { error: "Book search isn't answering. Try again, or add it by hand." };
	}
}
