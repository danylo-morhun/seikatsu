// Server-side search across Open Library and Google Books. Not a "use server" module: the
// library search is a route handler (a server action would queue each query behind the
// last), and createBook reuses the description fetch.

import { type BookSearchResult, dedupeResults } from "./book-search";
import { buildGoogleBooksUrl, parseGoogleBooksResponse } from "./google-books";
import {
	buildSearchUrl,
	buildWorkUrl,
	parseSearchResponse,
	parseWorkDescription,
} from "./open-library";

async function fetchJson(url: string, ms = 5000): Promise<unknown> {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), ms);
	try {
		const res = await fetch(url, {
			signal: controller.signal,
			headers: { "User-Agent": "seikatsu-tsundoku/1.0" },
		});
		if (!res.ok) throw new Error(`${res.status}`);
		return await res.json();
	} finally {
		clearTimeout(timer);
	}
}

export type SearchOutcome =
	| { ok: true; results: BookSearchResult[] }
	| { ok: false; error: string };

/**
 * Both providers in parallel, merged and deduped. One failing still returns the other's
 * results; only when both fail is it an error (not "no results").
 */
export async function searchProviders(query: string): Promise<SearchOutcome> {
	const [google, openLibrary] = await Promise.allSettled([
		fetchJson(buildGoogleBooksUrl(query)).then(parseGoogleBooksResponse),
		fetchJson(buildSearchUrl(query)).then(parseSearchResponse),
	]);
	if (google.status === "rejected" && openLibrary.status === "rejected") {
		return { ok: false, error: "Book search isn't answering. Try again, or add it by hand." };
	}
	// Google first so its richer metadata wins ties; OL covers backfill via merge.
	const results = [google, openLibrary].flatMap((r) => (r.status === "fulfilled" ? r.value : []));
	return { ok: true, results: dedupeResults(results) };
}

export async function fetchWorkDescription(olKey: string): Promise<string | null> {
	try {
		return parseWorkDescription(await fetchJson(buildWorkUrl(olKey)));
	} catch {
		return null;
	}
}
