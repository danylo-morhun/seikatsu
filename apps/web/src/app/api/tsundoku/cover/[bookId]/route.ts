import { getOwnedBook } from "@/features/tsundoku/actions/guard";
import { coverWidth } from "@/features/tsundoku/lib/cover";
import { getCurrentWorkspace } from "@/lib/session";
import type { NextRequest } from "next/server";

const MAX_BYTES = 8 * 1024 * 1024;

/**
 * One of the user's book covers, fetched from its source and resized to WebP. Only the
 * owner's books resolve, so this can't be used as an open image proxy. The URL carries a
 * hash of the source, so the browser may keep the image for a year.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ bookId: string }> }) {
	const workspace = await getCurrentWorkspace();
	if (!workspace) return new Response(null, { status: 401 });
	const { bookId } = await params;
	const book = await getOwnedBook(bookId, workspace.id);
	if (!book?.coverUrl?.startsWith("https://")) return new Response(null, { status: 404 });

	// Shop and library servers can be slow (Open Library redirects twice); a miss just
	// leaves the placeholder until the next visit.
	const source = await fetch(book.coverUrl, { signal: AbortSignal.timeout(8_000) }).catch(
		() => null,
	);
	const type = source?.headers.get("content-type") ?? "";
	if (!source?.ok || !type.startsWith("image/")) return new Response(null, { status: 502 });
	const bytes = Buffer.from(await source.arrayBuffer());
	if (bytes.byteLength > MAX_BYTES) return new Response(null, { status: 502 });

	const width = coverWidth(req.nextUrl.searchParams.get("w"));
	const small = await toWebp(bytes, width);
	// Without a resize the original still goes out: owner-only and cached, just heavier.
	return new Response(new Uint8Array(small ?? bytes), {
		headers: {
			"Content-Type": small ? "image/webp" : type,
			"Cache-Control": "private, max-age=31536000, immutable",
		},
	});
}

async function toWebp(bytes: Buffer, width: number): Promise<Buffer | null> {
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
