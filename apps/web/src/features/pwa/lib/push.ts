// Server-only: Web Push delivery and the send-once log. VAPID keys come from the environment
// (NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT) — see docs/ops/runbook.md.

import { and, db, eq, inArray, notificationLog, pushSubscriptions } from "@seikatsu/db";
import webpush from "web-push";

export interface PushPayload {
	title: string;
	body: string;
	/** Where a tap opens. */
	url: string;
	/** Same tag replaces the previous notification instead of stacking. */
	tag?: string;
}

let configured = false;
function configure(): boolean {
	if (configured) return true;
	const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
	const privateKey = process.env.VAPID_PRIVATE_KEY;
	if (!publicKey || !privateKey) return false;
	webpush.setVapidDetails(
		process.env.VAPID_SUBJECT ?? "https://seikatsu.danylomorhun.com",
		publicKey,
		privateKey,
	);
	configured = true;
	return true;
}

export function pushConfigured(): boolean {
	return !!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && !!process.env.VAPID_PRIVATE_KEY;
}

/** Sends to every device of the workspace; returns how many accepted it. Dead ones are dropped. */
export async function sendToWorkspace(workspaceId: string, payload: PushPayload): Promise<number> {
	if (!configure()) return 0;
	const subs = await db
		.select()
		.from(pushSubscriptions)
		.where(eq(pushSubscriptions.workspaceId, workspaceId));
	const body = JSON.stringify(payload);

	const results = await Promise.all(
		subs.map(async (sub) => {
			try {
				await webpush.sendNotification(
					{ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
					body,
					{ TTL: 60 * 60 * 12, urgency: "normal" },
				);
				return { id: sub.id, ok: true, gone: false };
			} catch (e) {
				const status = (e as { statusCode?: number }).statusCode;
				return { id: sub.id, ok: false, gone: status === 404 || status === 410 };
			}
		}),
	);

	const gone = results.filter((r) => r.gone).map((r) => r.id);
	const ok = results.filter((r) => r.ok).map((r) => r.id);
	await Promise.all([
		gone.length > 0 && db.delete(pushSubscriptions).where(inArray(pushSubscriptions.id, gone)),
		ok.length > 0 &&
			db
				.update(pushSubscriptions)
				.set({ lastSuccessAt: new Date() })
				.where(inArray(pushSubscriptions.id, ok)),
	]);
	return ok.length;
}

/**
 * Like `sendOnce` for several things in one notification: only the entries whose key wasn't
 * sent before make it in (a document reaching "7 days left" tells once, not every morning).
 */
export async function sendNew<T extends { key: string }>(
	workspaceId: string,
	entries: T[],
	build: (fresh: T[]) => PushPayload,
): Promise<boolean> {
	if (entries.length === 0) return false;
	const claimed = await db
		.insert(notificationLog)
		.values(entries.map((e) => ({ workspaceId, key: e.key })))
		.onConflictDoNothing()
		.returning({ key: notificationLog.key });
	if (claimed.length === 0) return false;

	const keys = new Set(claimed.map((c) => c.key));
	const delivered = await sendToWorkspace(
		workspaceId,
		build(entries.filter((e) => keys.has(e.key))),
	).catch(() => 0);
	if (delivered === 0) {
		await db
			.delete(notificationLog)
			.where(
				and(eq(notificationLog.workspaceId, workspaceId), inArray(notificationLog.key, [...keys])),
			);
		return false;
	}
	return true;
}

/**
 * Sends `payload` unless `key` was already sent for this workspace. The log row is claimed
 * first, so two overlapping cron runs can't both send; if no device took it, the claim is
 * released and the next run retries.
 */
export async function sendOnce(
	workspaceId: string,
	key: string,
	payload: PushPayload,
): Promise<boolean> {
	const claimed = await db
		.insert(notificationLog)
		.values({ workspaceId, key })
		.onConflictDoNothing()
		.returning({ key: notificationLog.key });
	if (claimed.length === 0) return false;

	const delivered = await sendToWorkspace(workspaceId, payload).catch(() => 0);
	if (delivered === 0) {
		await db
			.delete(notificationLog)
			.where(and(eq(notificationLog.workspaceId, workspaceId), eq(notificationLog.key, key)));
		return false;
	}
	return true;
}
