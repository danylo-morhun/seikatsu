// Google Books API — second search provider. No key required for low volume.
import type { BookSearchResult } from "./book-search";

interface GVolumeInfo {
	title?: string;
	authors?: string[];
	publishedDate?: string;
	pageCount?: number;
	description?: string;
	categories?: string[];
	imageLinks?: { thumbnail?: string; smallThumbnail?: string };
	industryIdentifiers?: { type?: string; identifier?: string }[];
}
interface GVolume {
	id?: string;
	volumeInfo?: GVolumeInfo;
}

export function buildGoogleBooksUrl(query: string, limit = 12): string {
	const params = new URLSearchParams({
		q: query,
		maxResults: String(Math.min(limit, 40)),
		printType: "books",
	});
	return `https://www.googleapis.com/books/v1/volumes?${params.toString()}`;
}

function pickIsbn(ids?: { type?: string; identifier?: string }[]): string | null {
	if (!ids) return null;
	const isbn13 = ids.find((i) => i.type === "ISBN_13")?.identifier;
	const isbn10 = ids.find((i) => i.type === "ISBN_10")?.identifier;
	return isbn13 ?? isbn10 ?? null;
}

function parseYear(date?: string): number | null {
	if (!date) return null;
	const m = date.match(/^(\d{4})/);
	return m ? Number.parseInt(m[1], 10) : null;
}

function mapVolume(v: GVolume): BookSearchResult | null {
	const info = v.volumeInfo;
	if (!v.id || !info?.title) return null;
	const thumb = info.imageLinks?.thumbnail ?? info.imageLinks?.smallThumbnail ?? null;
	return {
		source: "google",
		externalId: v.id,
		title: info.title,
		authors: info.authors ?? [],
		isbn: pickIsbn(info.industryIdentifiers),
		// Google thumbnails come over http with zoom params — normalize to https.
		coverUrl: thumb ? thumb.replace(/^http:/, "https:") : null,
		publishedYear: parseYear(info.publishedDate),
		pageCount: info.pageCount ?? null,
		subjects: (info.categories ?? []).slice(0, 6),
		description: info.description ?? null,
	};
}

export function parseGoogleBooksResponse(json: unknown): BookSearchResult[] {
	const items = (json as { items?: GVolume[] })?.items ?? [];
	return items.map(mapVolume).filter((r): r is BookSearchResult => r !== null);
}
