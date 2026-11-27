"use server";

// The device's time zone, followed: when the browser's zone changes (a trip, a move), the pushes
// and the Google calendar link take it too, so "9:00" and "today" stay the user's own.

import { and, db, eq, googleAccounts, ne, notificationPrefs } from "@seikatsu/db";
import { after } from "next/server";
import { syncGoogle } from "@/features/calendar/google/sync";
import { getCurrentWorkspace } from "@/lib/session";
import { isValidZone } from "@/lib/timezone";

export async function followZone(zone: string): Promise<void> {
	if (!isValidZone(zone)) return;
	const ws = await getCurrentWorkspace();
	if (!ws) return;
	await db
		.update(notificationPrefs)
		.set({ timeZone: zone })
		.where(and(eq(notificationPrefs.workspaceId, ws.id), ne(notificationPrefs.timeZone, zone)));
	const moved = await db
		.update(googleAccounts)
		.set({ timeZone: zone })
		.where(and(eq(googleAccounts.workspaceId, ws.id), ne(googleAccounts.timeZone, zone)))
		.returning({ workspaceId: googleAccounts.workspaceId });
	// Google's events were laid out on the old clock: read again on the new one.
	if (moved.length > 0) after(() => syncGoogle(ws.id, { pull: true }));
}
