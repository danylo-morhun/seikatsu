"use server";

import { put } from "@vercel/blob";
import { requireWorkspace } from "@/features/tsundoku/actions/guard";
import { uploadPrefix } from "@/features/tsundoku/lib/cover-store";

// The covers the resizer (sharp) reads everywhere; HEIC isn't one of them on the server.
const COVER_TYPES: Record<string, string> = {
	"image/jpeg": "jpg",
	"image/png": "png",
	"image/webp": "webp",
	"image/avif": "avif",
	"image/gif": "gif",
};
// Under the hosting platform's 4.5 MB request limit.
const MAX_BYTES = 4 * 1024 * 1024;

/**
 * A cover from the device, stored at once; the form puts its URL in the cover field, and saving
 * the book resizes it like any other cover.
 */
export async function uploadCover(
	formData: FormData,
): Promise<{ error: string } | { success: true; data: { url: string } }> {
	const workspace = await requireWorkspace();
	if (!process.env.BLOB_READ_WRITE_TOKEN) return { error: "Uploads aren't set up here." };
	const file = formData.get("cover");
	if (!(file instanceof File) || file.size === 0) return { error: "Pick an image" };
	const ext = COVER_TYPES[file.type];
	if (!ext) return { error: "Use a JPEG, PNG, WebP, AVIF or GIF image." };
	if (file.size > MAX_BYTES) return { error: "The image must be under 4 MB." };
	try {
		const blob = await put(`${uploadPrefix(workspace.id)}cover.${ext}`, file, {
			access: "public",
			contentType: file.type,
			addRandomSuffix: true,
		});
		return { success: true, data: { url: blob.url } };
	} catch {
		return { error: "Couldn't upload the cover. Try again in a moment." };
	}
}
