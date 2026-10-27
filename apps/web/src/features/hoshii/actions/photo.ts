// A want's photos (its own and each link's), copied from the shops into our blob store:
// shop links rot. Not a "use server" module — runs inside actions (often in `after()`).

import { fetchImage, publicUrl } from "@/features/hoshii/lib/fetch-web";
import { type HoshiiLink, db, eq, hoshiiItems } from "@seikatsu/db";
import { del, put } from "@vercel/blob";

type Photos = { imageUrl: string | null; links: HoshiiLink[] };

export const isStoredPhoto = (url: string | null) => {
	if (!url) return false;
	try {
		return new URL(url).hostname.endsWith(".blob.vercel-storage.com");
	} catch {
		return false;
	}
};

/** Ours to delete: a copy or upload in this workspace's folder. */
export function isOwnPhoto(url: string | null, workspaceId: string): url is string {
	if (!url || !isStoredPhoto(url)) return false;
	return new URL(url).pathname.startsWith(`/hoshii/${workspaceId}/`);
}

/** Every photo a want shows: its own and its links'. */
export function photosOf(item: Photos): Set<string> {
	const urls = [item.imageUrl, ...item.links.map((l) => l.imageUrl)];
	return new Set(urls.filter((u): u is string => u != null));
}

async function copy(itemId: string, workspaceId: string, imageUrl: string) {
	const url = publicUrl(imageUrl);
	if (!url) return null;
	try {
		const { bytes, type, ext } = await fetchImage(url);
		const blob = await put(`hoshii/${workspaceId}/${itemId}.${ext}`, Buffer.from(bytes), {
			access: "public",
			contentType: type,
			addRandomSuffix: true,
		});
		return blob.url;
	} catch (error) {
		console.warn("[hoshii] photo not copied", error);
		return null;
	}
}

/** Copies the shops' photos and points the want at the copies. Failures keep the shop's link. */
export async function keepPhotos(itemId: string, workspaceId: string, item: Photos) {
	const shop = [...photosOf(item)].filter((u) => !isStoredPhoto(u));
	if (shop.length === 0) return;
	const copies = new Map<string, string>();
	await Promise.all(
		shop.map(async (u) => {
			const stored = await copy(itemId, workspaceId, u);
			if (stored) copies.set(u, stored);
		}),
	);
	if (copies.size === 0) return;

	// Swap in what's still there (an edit may have changed it meanwhile).
	const [row] = await db
		.select({ imageUrl: hoshiiItems.imageUrl, links: hoshiiItems.links })
		.from(hoshiiItems)
		.where(eq(hoshiiItems.id, itemId))
		.limit(1);
	const swap = (u: string | null) => (u && copies.get(u)) || u;
	const swapped = row && {
		imageUrl: swap(row.imageUrl),
		links: row.links.map((l) => ({ ...l, imageUrl: swap(l.imageUrl) })),
	};
	if (swapped) await db.update(hoshiiItems).set(swapped).where(eq(hoshiiItems.id, itemId));
	const used = swapped ? photosOf(swapped) : new Set<string>();
	const unused = [...copies.values()].filter((c) => !used.has(c));
	if (unused.length > 0) await del(unused).catch(() => {});
}

/** The copies an edit or delete left behind. */
export async function dropPhotos(before: Photos, after: Photos | null, workspaceId: string) {
	const kept = after ? photosOf(after) : new Set<string>();
	const gone = [...photosOf(before)].filter((u) => !kept.has(u) && isOwnPhoto(u, workspaceId));
	if (gone.length === 0) return;
	try {
		await del(gone);
	} catch (error) {
		console.warn("[hoshii] photos not deleted", error);
	}
}
