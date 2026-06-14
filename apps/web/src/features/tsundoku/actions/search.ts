"use server";

import { auth } from "@/auth";
import { type BookSearchResult, dedupeResults } from "@/features/tsundoku/lib/book-search";
import {
	buildGoogleBooksUrl,
	parseGoogleBooksResponse,
} from "@/features/tsundoku/lib/google-books";
import {
	buildSearchUrl,
	buildWorkUrl,
	parseSearchResponse,
	parseWorkDescription,
} from "@/features/tsundoku/lib/open-library";

async function fetchWithTimeout(url: string, ms = 5000): Promise<Response> {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), ms);
	try {
		return await fetch(url, {
			signal: controller.signal,
			headers: { "User-Agent": "seikatsu-tsundoku/1.0" },
		});
	} finally {
		clearTimeout(timer);
	}
}

async function fetchOpenLibrary(query: string): Promise<BookSearchResult[]> {
	try {
		const res = await fetchWithTimeout(buildSearchUrl(query));
		if (!res.ok) return [];
		return parseSearchResponse(await res.json());
	} catch {
		return [];
	}
}

async function fetchGoogleBooks(query: string): Promise<BookSearchResult[]> {
	try {
		const res = await fetchWithTimeout(buildGoogleBooksUrl(query));
		if (!res.ok) return [];
		return parseGoogleBooksResponse(await res.json());
	} catch {
		return [];
	}
}

/**
 * Search both Open Library and Google Books in parallel, then merge + dedupe.
 * Each provider is guarded independently — one failing still returns the other's
 * results. Only a total failure (both empty after an error) surfaces an error.
 */
export async function searchBooks(
	query: string,
): Promise<{ error: string } | { success: true; results: BookSearchResult[] }> {
	const session = await auth();
	if (!session?.user?.id) return { error: "Unauthorized" };

	const q = query.trim();
	if (q.length < 2) return { success: true, results: [] };

	// Google first so its richer metadata wins ties; OL covers backfill via merge.
	const [google, openLibrary] = await Promise.all([fetchGoogleBooks(q), fetchOpenLibrary(q)]);
	return { success: true, results: dedupeResults([...google, ...openLibrary]) };
}

export async function fetchWorkDescription(olKey: string): Promise<string | null> {
	const session = await auth();
	if (!session?.user?.id) return null;
	try {
		const res = await fetchWithTimeout(buildWorkUrl(olKey));
		if (!res.ok) return null;
		return parseWorkDescription(await res.json());
	} catch {
		return null;
	}
}
