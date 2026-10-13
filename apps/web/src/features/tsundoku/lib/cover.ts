// Covers are pasted from any shop or library site at full size (often 300–500 KB). Once seen,
// a cover is resized and kept in the blob store, served from the CDN. Until then the app's own
// route fetches and resizes it, so only the owner's books can be fetched.

/** The widths the cover route renders; anything else snaps to the nearest one. */
export const COVER_WIDTHS = [96, 192, 384] as const;

export function coverWidth(raw: string | null): number {
	const asked = Number(raw);
	if (!Number.isFinite(asked) || asked <= 0) return 192;
	return COVER_WIDTHS.find((w) => w >= asked) ?? 384;
}

/** A short hash of the source, so a changed cover is a new URL and the old cache never wins. */
export function coverVersion(coverUrl: string): string {
	let hash = 5381;
	for (let i = 0; i < coverUrl.length; i++) hash = (hash * 33) ^ coverUrl.charCodeAt(i);
	return (hash >>> 0).toString(36);
}

export function coverSrc(bookId: string, coverUrl: string, width = 192): string {
	return `/api/tsundoku/cover/${bookId}?w=${width}&v=${coverVersion(coverUrl)}`;
}

export function coverSrcSet(bookId: string, coverUrl: string): string {
	return COVER_WIDTHS.map((w) => `${coverSrc(bookId, coverUrl, w)} ${w}w`).join(", ");
}

/**
 * A stored cover's blob path: one store serves every environment (and dev's books share ids
 * with prod), so the environment comes first. The source's hash keeps an old cover apart.
 */
export function coverBlobPath(
	env: string,
	bookId: string,
	coverUrl: string,
	width: number,
): string {
	return `tsundoku/covers/${env}/${bookId}/${coverVersion(coverUrl)}-${width}.webp`;
}

/** The stored cover's base, from the URL of any of its widths. */
export function coverBlobBase(url: string): string {
	return url.replace(/-\d+\.webp$/, "");
}

export function storedCoverSrc(base: string, width = 192): string {
	return `${base}-${width}.webp`;
}

export function storedCoverSrcSet(base: string): string {
	return COVER_WIDTHS.map((w) => `${storedCoverSrc(base, w)} ${w}w`).join(", ");
}
