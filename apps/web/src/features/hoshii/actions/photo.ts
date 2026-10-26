// A want's photo, copied from the shop into our blob store: shop links rot.
// Not a "use server" module — runs inside actions (often in `after()`).

import { fetchImage, publicUrl } from "@/features/hoshii/lib/fetch-web";
import { and, db, eq, hoshiiItems } from "@seikatsu/db";
import { del, put } from "@vercel/blob";

export const isStoredPhoto = (url: string | null) => {
	if (!url) return false;
	try {
		return new URL(url).hostname.endsWith(".blob.vercel-storage.com");
	} catch {
		return false;
	}
};

/** Copies the shop's photo and points the item at the copy. Failures keep the shop's link. */
export async function keepPhoto(itemId: string, workspaceId: string, imageUrl: string) {
	const url = publicUrl(imageUrl);
	if (!url || isStoredPhoto(imageUrl)) return;
	try {
		const { bytes, type, ext } = await fetchImage(url);
		const blob = await put(`hoshii/${workspaceId}/${itemId}.${ext}`, Buffer.from(bytes), {
			access: "public",
			contentType: type,
			addRandomSuffix: true,
		});
		const updated = await db
			.update(hoshiiItems)
			.set({ imageUrl: blob.url })
			// Only if the photo is still the one copied (an edit may have changed it).
			.where(and(eq(hoshiiItems.id, itemId), eq(hoshiiItems.imageUrl, imageUrl)))
			.returning({ id: hoshiiItems.id });
		if (updated.length === 0) await del(blob.url);
	} catch (error) {
		console.warn("[hoshii] photo not copied", error);
	}
}

export async function dropPhoto(url: string | null) {
	if (!url || !isStoredPhoto(url)) return;
	try {
		await del(url);
	} catch (error) {
		console.warn("[hoshii] photo not deleted", error);
	}
}
