"use server";

import { auth } from "@/auth";
import { put } from "@vercel/blob";

const ALLOWED_TYPES = new Set([
	"application/pdf",
	"application/msword",
	"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const MAX_SIZE = 5 * 1024 * 1024;

export async function uploadResumeFile(
	formData: FormData,
): Promise<{ error: string } | { success: true; fileUrl: string; fileName: string }> {
	const session = await auth();
	if (!session?.user?.id) return { error: "Unauthorized" };

	const file = formData.get("file");
	if (!(file instanceof File) || file.size === 0) return { error: "No file provided" };
	if (!ALLOWED_TYPES.has(file.type)) return { error: "Only PDF or Word documents are allowed" };
	if (file.size > MAX_SIZE) return { error: "File must be under 5 MB" };

	const { url } = await put(`kyuu-resumes/${session.user.id}/${Date.now()}-${file.name}`, file, {
		access: "public",
	});

	return { success: true, fileUrl: url, fileName: file.name };
}
