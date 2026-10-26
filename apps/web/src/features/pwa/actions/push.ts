"use server";

import { pushConfigured, sendToWorkspace } from "@/features/pwa/lib/push";
import { safeTimeZone } from "@/features/pwa/lib/schedule";
import { getCurrentWorkspace } from "@/lib/session";
import {
	type NotificationPrefs,
	and,
	asc,
	db,
	eq,
	notificationPrefs,
	pushSubscriptions,
} from "@seikatsu/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";

type Result = { error: string } | { success: true };

const PATH = "/settings/notifications";

const subscriptionSchema = z.object({
	endpoint: z.url().max(2000),
	keys: z.object({ p256dh: z.string().min(1).max(500), auth: z.string().min(1).max(500) }),
});

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(:00)?$/);

const prefsSchema = z.object({
	timeZone: z.string().max(100),
	morningTime: time,
	keizokuEnabled: z.boolean(),
	keizokuTime: time,
	kyuuEnabled: z.boolean(),
	aishaEnabled: z.boolean(),
	kurojiRecurring: z.boolean(),
	kurojiBudget: z.boolean(),
	kurojiWeekly: z.boolean(),
});

export type PrefsInput = z.infer<typeof prefsSchema>;

export interface PushDevice {
	id: string;
	endpoint: string;
	userAgent: string | null;
	createdAt: Date;
	lastSuccessAt: Date | null;
}

export interface NotificationSettings {
	prefs: NotificationPrefs | null;
	devices: PushDevice[];
	/** VAPID keys are set on the server; without them nothing can be sent. */
	configured: boolean;
}

export async function getNotificationSettings(): Promise<NotificationSettings> {
	const ws = await getCurrentWorkspace();
	if (!ws) return { prefs: null, devices: [], configured: pushConfigured() };
	const [prefs, devices] = await Promise.all([
		db.query.notificationPrefs.findFirst({ where: eq(notificationPrefs.workspaceId, ws.id) }),
		db
			.select({
				id: pushSubscriptions.id,
				endpoint: pushSubscriptions.endpoint,
				userAgent: pushSubscriptions.userAgent,
				createdAt: pushSubscriptions.createdAt,
				lastSuccessAt: pushSubscriptions.lastSuccessAt,
			})
			.from(pushSubscriptions)
			.where(eq(pushSubscriptions.workspaceId, ws.id))
			.orderBy(asc(pushSubscriptions.createdAt)),
	]);
	return { prefs: prefs ?? null, devices, configured: pushConfigured() };
}

/** Stores this device's push subscription; the first one also creates the default prefs. */
export async function subscribePush(
	subscription: unknown,
	timeZone: string,
	userAgent: string,
): Promise<Result> {
	const ws = await getCurrentWorkspace();
	if (!ws) return { error: "Not signed in" };
	const parsed = subscriptionSchema.safeParse(subscription);
	if (!parsed.success) return { error: "That subscription isn't valid." };
	const { endpoint, keys } = parsed.data;

	await db.transaction(async (tx) => {
		// An endpoint belongs to one browser profile; re-subscribing moves it to this workspace.
		await tx
			.insert(pushSubscriptions)
			.values({
				workspaceId: ws.id,
				endpoint,
				p256dh: keys.p256dh,
				auth: keys.auth,
				userAgent: userAgent.slice(0, 300),
			})
			.onConflictDoUpdate({
				target: pushSubscriptions.endpoint,
				set: { workspaceId: ws.id, p256dh: keys.p256dh, auth: keys.auth },
			});
		await tx
			.insert(notificationPrefs)
			.values({ workspaceId: ws.id, timeZone: safeTimeZone(timeZone) })
			.onConflictDoUpdate({
				target: notificationPrefs.workspaceId,
				set: { timeZone: safeTimeZone(timeZone) },
			});
	});

	revalidatePath(PATH);
	return { success: true };
}

export async function unsubscribePush(endpoint: string): Promise<Result> {
	const ws = await getCurrentWorkspace();
	if (!ws) return { error: "Not signed in" };
	await db
		.delete(pushSubscriptions)
		.where(and(eq(pushSubscriptions.workspaceId, ws.id), eq(pushSubscriptions.endpoint, endpoint)));
	revalidatePath(PATH);
	return { success: true };
}

export async function removeDevice(deviceId: string): Promise<Result> {
	const ws = await getCurrentWorkspace();
	if (!ws) return { error: "Not signed in" };
	if (!z.uuid().safeParse(deviceId).success) return { error: "Device not found" };
	await db
		.delete(pushSubscriptions)
		.where(and(eq(pushSubscriptions.workspaceId, ws.id), eq(pushSubscriptions.id, deviceId)));
	revalidatePath(PATH);
	return { success: true };
}

export async function saveNotificationPrefs(input: PrefsInput): Promise<Result> {
	const ws = await getCurrentWorkspace();
	if (!ws) return { error: "Not signed in" };
	const parsed = prefsSchema.safeParse(input);
	if (!parsed.success) return { error: "Check the times and try again." };
	const values = {
		...parsed.data,
		timeZone: safeTimeZone(parsed.data.timeZone),
		updatedAt: new Date(),
	};
	await db
		.insert(notificationPrefs)
		.values({ workspaceId: ws.id, ...values })
		.onConflictDoUpdate({ target: notificationPrefs.workspaceId, set: values });
	revalidatePath(PATH);
	return { success: true };
}

export async function sendTestNotification(): Promise<Result> {
	const ws = await getCurrentWorkspace();
	if (!ws) return { error: "Not signed in" };
	if (!pushConfigured()) return { error: "Push isn't set up on the server (VAPID keys)." };
	const delivered = await sendToWorkspace(ws.id, {
		title: "seikatsu",
		body: "Notifications work on this device.",
		url: PATH,
		tag: "test",
	});
	return delivered > 0 ? { success: true } : { error: "No device took it. Enable push again." };
}
