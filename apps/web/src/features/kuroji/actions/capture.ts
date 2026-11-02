"use server";

import { randomBytes } from "node:crypto";
import { and, db, eq, kurojiCaptureKeys, kurojiCaptures } from "@seikatsu/db";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { hashCaptureKey } from "@/features/kuroji/lib/capture-intake";
import { getOwnedWorkspace, isUuid } from "@/lib/session";

type Result<T = unknown> = { error: string } | ({ success: true } & T);

async function owned(workspaceId: string) {
	const session = await auth();
	if (!session?.user?.id) return null;
	return getOwnedWorkspace(workspaceId);
}

// ── The inbox ──

export async function dismissCapture(captureId: string): Promise<Result> {
	const session = await auth();
	if (!session?.user?.id) return { error: "Unauthorized" };
	if (!isUuid(captureId)) return { error: "Payment not found" };
	const [row] = await db
		.select({ workspaceId: kurojiCaptures.workspaceId })
		.from(kurojiCaptures)
		.where(eq(kurojiCaptures.id, captureId))
		.limit(1);
	if (!row || !(await getOwnedWorkspace(row.workspaceId))) return { error: "Payment not found" };
	await db
		.update(kurojiCaptures)
		.set({ state: "dismissed" })
		.where(and(eq(kurojiCaptures.id, captureId), eq(kurojiCaptures.state, "pending")));
	revalidatePath("/kuroji", "layout");
	return { success: true };
}

// ── The Shortcut's key ──

/** A new key for the Shortcut; the old one stops working. Shown once, stored hashed. */
export async function createCaptureKey(workspaceId: string): Promise<Result<{ key: string }>> {
	if (!(await owned(workspaceId))) return { error: "Forbidden" };
	const key = `kuroji_${randomBytes(32).toString("base64url")}`;
	await db
		.insert(kurojiCaptureKeys)
		.values({ workspaceId, keyHash: hashCaptureKey(key) })
		.onConflictDoUpdate({
			target: kurojiCaptureKeys.workspaceId,
			set: { keyHash: hashCaptureKey(key), createdAt: new Date(), lastUsedAt: null },
		});
	revalidatePath("/settings/kuroji");
	return { success: true, key };
}

export async function deleteCaptureKey(workspaceId: string): Promise<Result> {
	if (!(await owned(workspaceId))) return { error: "Forbidden" };
	await db.delete(kurojiCaptureKeys).where(eq(kurojiCaptureKeys.workspaceId, workspaceId));
	revalidatePath("/settings/kuroji");
	return { success: true };
}
