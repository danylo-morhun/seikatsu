// Server only: fetching a cover from its source, resizing it, and keeping it in the blob store.

import {
	COVER_WIDTHS,
	coverBlobBase,
	coverBlobPath,
	storedCoverSrc,
} from "@/features/tsundoku/lib/cover";
import { and, db, eq, tsundokuBooks } from "@seikatsu/db";
import { del, put } from "@vercel/blob";

const MAX_BYTES = 8 * 1024 * 1024;

/** The cover from its source. Shop and library servers can be slow (Open Library redirects twice). */
export async function fetchCover(url: string): Promise<{ bytes: Buffer; type: string } | null> {
	const source = await fetch(url, { signal: AbortSignal.timeout(8_000) }).catch(() => null);
	const type = source?.headers.get("content-type") ?? "";
	if (!source?.ok || !type.startsWith("image/")) return null;
	const bytes = Buffer.from(await source.arrayBuffer());
	return bytes.byteLength > MAX_BYTES ? null : { bytes, type };
}

export async function toWebp(bytes: Buffer, width: number): Promise<Buffer | null> {
	try {
		// Loaded here, not at the top: auth and ownership answers never wait on the native module.
		const { default: sharp } = await import("sharp");
		return await sharp(bytes)
			.rotate()
			.resize({ width, withoutEnlargement: true })
			.webp({ quality: 78 })
			.toBuffer();
	} catch (error) {
		console.error("[tsundoku] cover resize failed", error);
		return null;
	}
}

/**
 * Resizes the cover to every width, keeps them in the blob store and points the book at them.
 * Runs after the response; a failure leaves the book on the cover route, which tries again.
 */
export async function storeCover(bookId: string, coverUrl: string, bytes?: Buffer): Promise<void> {
	if (!process.env.BLOB_READ_WRITE_TOKEN) return;
	try {
		const source = bytes ?? (await fetchCover(coverUrl))?.bytes;
		if (!source) return;
		const env = process.env.VERCEL_ENV ?? "local";
		const urls = await Promise.all(
			COVER_WIDTHS.map(async (width) => {
				const webp = await toWebp(source, width);
				if (!webp) throw new Error("resize failed");
				const blob = await put(coverBlobPath(env, bookId, coverUrl, width), webp, {
					access: "public",
					contentType: "image/webp",
					// The path carries the source's hash, so a write is always the same image.
					addRandomSuffix: false,
					allowOverwrite: true,
					cacheControlMaxAge: 31_536_000,
				});
				return blob.url;
			}),
		);
		// Only if the cover wasn't changed meanwhile.
		await db
			.update(tsundokuBooks)
			.set({ coverBlob: coverBlobBase(urls[0]) })
			.where(and(eq(tsundokuBooks.id, bookId), eq(tsundokuBooks.coverUrl, coverUrl)));
	} catch (error) {
		console.error("[tsundoku] cover store failed", error);
	}
}

/** Removes a stored cover (the book's cover changed or the book is gone). */
export async function dropCover(base: string | null): Promise<void> {
	if (!base || !process.env.BLOB_READ_WRITE_TOKEN) return;
	await del(COVER_WIDTHS.map((w) => storedCoverSrc(base, w))).catch((error) =>
		console.error("[tsundoku] cover delete failed", error),
	);
}
