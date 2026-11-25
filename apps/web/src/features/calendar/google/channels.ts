// Server-only: Google's push channels — Google calls /api/calendar/google/hook when a watched
// calendar changes, so an edit there shows here within seconds. A channel lasts about a week;
// the cron renews them. Only on a public https address (not on localhost).

import { randomBytes, timingSafeEqual } from "node:crypto";
import { and, db, eq, googleAccounts, googleCalendars, isNotNull, or } from "@seikatsu/db";
import { calendarApi, tokenFor } from "@/features/calendar/google/api";

/** Renewed when it has less than this left. */
const MARGIN = 24 * 60 * 60 * 1000;

function hookAddress(): string | null {
	const base = process.env.AUTH_URL?.replace(/\/$/, "");
	return base?.startsWith("https://") ? `${base}/api/calendar/google/hook` : null;
}

/** Watches the shown calendars and seikatsu's own; stops watching the rest. */
export async function renewChannels(workspaceId: string) {
	const address = hookAddress();
	if (!address) return;
	const [account] = await db
		.select()
		.from(googleAccounts)
		.where(eq(googleAccounts.workspaceId, workspaceId));
	if (!account) return;
	const api = calendarApi(await tokenFor(account));
	const calendars = await db
		.select()
		.from(googleCalendars)
		.where(eq(googleCalendars.workspaceId, workspaceId));
	for (const c of calendars) {
		const wanted = c.shown || c.own;
		const live = c.channelExpiresAt && c.channelExpiresAt.getTime() > Date.now() + MARGIN;
		if (wanted && live) continue;
		if (c.channelId && c.channelResourceId)
			await api.stop({ id: c.channelId, resourceId: c.channelResourceId });
		if (!wanted) {
			await db
				.update(googleCalendars)
				.set({
					channelId: null,
					channelResourceId: null,
					channelToken: null,
					channelExpiresAt: null,
				})
				.where(eq(googleCalendars.id, c.id));
			continue;
		}
		const channel = {
			id: crypto.randomUUID(),
			token: randomBytes(24).toString("base64url"),
			address,
		};
		const res = await api.watch(c.googleId, channel);
		await db
			.update(googleCalendars)
			.set({
				channelId: channel.id,
				channelResourceId: res.resourceId,
				channelToken: channel.token,
				channelExpiresAt: new Date(Number(res.expiration)),
			})
			.where(eq(googleCalendars.id, c.id));
	}
}

/** Stops every channel of a workspace (disconnect). Best effort. */
export async function stopChannels(workspaceId: string, token: string) {
	const api = calendarApi(token);
	const calendars = await db
		.select()
		.from(googleCalendars)
		.where(
			and(
				eq(googleCalendars.workspaceId, workspaceId),
				or(isNotNull(googleCalendars.channelId), isNotNull(googleCalendars.channelResourceId)),
			),
		);
	for (const c of calendars)
		if (c.channelId && c.channelResourceId)
			await api.stop({ id: c.channelId, resourceId: c.channelResourceId });
}

/** The workspace a ping is for, when its channel and token match one of ours. */
export async function workspaceOfPing(channelId: string, token: string): Promise<string | null> {
	const [c] = await db
		.select({ workspaceId: googleCalendars.workspaceId, token: googleCalendars.channelToken })
		.from(googleCalendars)
		.where(eq(googleCalendars.channelId, channelId));
	if (!c?.token) return null;
	const a = Buffer.from(c.token);
	const b = Buffer.from(token);
	return a.length === b.length && timingSafeEqual(a, b) ? c.workspaceId : null;
}
