"use server";

import { isOwnPhoto } from "@/features/hoshii/actions/photo";
import { IMAGE_MAX } from "@/features/hoshii/lib/fetch-web";
import { getCurrentWorkspace } from "@/lib/session";
import { db, eq, hoshiiItems } from "@seikatsu/db";
import { del, put } from "@vercel/blob";

const PHOTO_TYPES: Record<string, string> = {
	"image/jpeg": "jpg",
	"image/png": "png",
	"image/webp": "webp",
	"image/gif": "gif",
	"image/avif": "avif",
	"image/heic": "heic",
	"image/heif": "heif",
};

/** A photo from the device, stored at once so the form can show it. Saved with the want. */
export async function uploadPhoto(
	formData: FormData,
): Promise<{ error: string } | { success: true; data: { url: string } }> {
	const ws = await getCurrentWorkspace();
	if (!ws) return { error: "Not signed in" };
	const file = formData.get("photo");
	if (!(file instanceof File) || file.size === 0) return { error: "Pick a photo" };
	const ext = PHOTO_TYPES[file.type];
	if (!ext) return { error: "Use a JPEG, PNG, WebP, GIF or HEIC photo." };
	if (file.size > IMAGE_MAX) return { error: "The photo must be under 5 MB." };
	try {
		const blob = await put(`hoshii/${ws.id}/upload.${ext}`, file, {
			access: "public",
			contentType: file.type,
			addRandomSuffix: true,
		});
		return { success: true, data: { url: blob.url } };
	} catch {
		return { error: "Couldn't upload the photo. Try again in a moment." };
	}
}

/** An upload the form let go of (replaced, removed, or the dialog closed) and no want uses. */
export async function discardPhoto(url: string): Promise<void> {
	const ws = await getCurrentWorkspace();
	if (!ws || !isOwnPhoto(url, ws.id)) return;
	const [used] = await db
		.select({ id: hoshiiItems.id })
		.from(hoshiiItems)
		.where(eq(hoshiiItems.imageUrl, url))
		.limit(1);
	if (used) return;
	try {
		await del(url);
	} catch (error) {
		console.warn("[hoshii] upload not deleted", error);
	}
}
