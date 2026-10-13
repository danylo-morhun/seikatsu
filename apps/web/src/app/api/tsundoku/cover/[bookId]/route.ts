import { getOwnedBook } from "@/features/tsundoku/actions/guard";
import { coverWidth, storedCoverSrc } from "@/features/tsundoku/lib/cover";
import { fetchCover, storeCover, toWebp } from "@/features/tsundoku/lib/cover-store";
import { getCurrentWorkspace } from "@/lib/session";
import { type NextRequest, after } from "next/server";

const CACHE = "private, max-age=31536000, immutable";

/**
 * One of the user's book covers. A stored cover redirects to the blob store; otherwise it's
 * fetched from its source, resized to WebP, and stored after the response for next time.
 * Only the owner's books resolve, so this can't be used as an open image proxy. The URL
 * carries a hash of the source, so the browser may keep the image for a year.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ bookId: string }> }) {
	const workspace = await getCurrentWorkspace();
	if (!workspace) return new Response(null, { status: 401 });
	const { bookId } = await params;
	const book = await getOwnedBook(bookId, workspace.id);
	const coverUrl = book?.coverUrl;
	if (!book || !coverUrl?.startsWith("https://")) return new Response(null, { status: 404 });

	const width = coverWidth(req.nextUrl.searchParams.get("w"));
	if (book.coverBlob) {
		// Same source hash, same stored file: the browser can keep the redirect too.
		return new Response(null, {
			status: 307,
			headers: { Location: storedCoverSrc(book.coverBlob, width), "Cache-Control": CACHE },
		});
	}

	// A miss just leaves the placeholder until the next visit.
	const source = await fetchCover(coverUrl);
	if (!source) return new Response(null, { status: 502 });
	after(() => storeCover(book.id, coverUrl, source.bytes));

	const small = await toWebp(source.bytes, width);
	// Without a resize the original still goes out: owner-only and cached, just heavier.
	return new Response(new Uint8Array(small ?? source.bytes), {
		headers: {
			"Content-Type": small ? "image/webp" : source.type,
			"Cache-Control": CACHE,
		},
	});
}
