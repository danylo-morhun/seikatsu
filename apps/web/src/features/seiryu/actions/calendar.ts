"use server";

import { randomBytes } from "node:crypto";
import { db, eq, seiryuCalendarFeeds } from "@seikatsu/db";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { hashSecret, originOf } from "@/features/mcp/lib/oauth";
import { requireWorkspace } from "@/features/seiryu/actions/guard";
import { feedUrl } from "@/features/seiryu/lib/calendar-feed";

/** A new calendar link (the old one stops working); its URL is shown once, then kept hashed. */
export async function createCalendarFeed(): Promise<{ error: string } | { url: string }> {
	const workspace = await requireWorkspace();
	const token = `cal_${randomBytes(24).toString("base64url")}`;
	await db
		.insert(seiryuCalendarFeeds)
		.values({ workspaceId: workspace.id, tokenHash: hashSecret(token) })
		.onConflictDoUpdate({
			target: seiryuCalendarFeeds.workspaceId,
			set: { tokenHash: hashSecret(token), createdAt: new Date() },
		});
	revalidatePath("/settings/seiryu");
	return { url: feedUrl(originOf(await headers()), token) };
}

export async function removeCalendarFeed(): Promise<{ error: string } | { success: true }> {
	const workspace = await requireWorkspace();
	await db.delete(seiryuCalendarFeeds).where(eq(seiryuCalendarFeeds.workspaceId, workspace.id));
	revalidatePath("/settings/seiryu");
	return { success: true };
}
