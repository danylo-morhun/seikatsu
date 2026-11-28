// Server-only: Google's OAuth and Calendar API, over fetch with a 15 s timeout each (Google
// can take longer than the usual 5 s to make a calendar or list a year of events; a write cut
// short still lands in Google, so a too-short timeout makes duplicates). The account's
// tokens are sealed in google_accounts; an expired access token is refreshed and saved here.

import { db, eq, googleAccounts } from "@seikatsu/db";
import type { GoogleEvent } from "@/features/calendar/google/map";
import { seal, unseal } from "@/lib/seal";

const AUTH = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN = "https://oauth2.googleapis.com/token";
const USERINFO = "https://openidconnect.googleapis.com/v1/userinfo";
const API = "https://www.googleapis.com/calendar/v3";

export const SCOPES = ["openid", "email", "https://www.googleapis.com/auth/calendar"];

const TIMEOUT = 15_000;

export class GoogleError extends Error {
	constructor(
		readonly status: number,
		message: string,
	) {
		super(message);
	}
}

async function call<T>(url: string, init: RequestInit = {}): Promise<T> {
	// A read that times out is asked once more (a first sync pulls a lot); a write isn't,
	// since one cut short may still have landed.
	const reads = !init.method || init.method === "GET";
	for (let attempt = 0; ; attempt++) {
		try {
			return await callOnce<T>(url, init);
		} catch (e) {
			const timedOut = e instanceof Error && e.name === "AbortError";
			if (timedOut && reads && attempt === 0) continue;
			if (timedOut) throw new GoogleError(0, `Google didn't answer in ${TIMEOUT / 1000} s`);
			throw e;
		}
	}
}

async function callOnce<T>(url: string, init: RequestInit): Promise<T> {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), TIMEOUT);
	try {
		const res = await fetch(url, { ...init, signal: controller.signal, cache: "no-store" });
		if (res.status === 204) return undefined as T;
		const body = await res.json().catch(() => ({}));
		if (!res.ok)
			throw new GoogleError(
				res.status,
				(body as { error?: { message?: string }; error_description?: string }).error?.message ??
					(body as { error_description?: string }).error_description ??
					`Google answered ${res.status}`,
			);
		return body as T;
	} finally {
		clearTimeout(timer);
	}
}

function client() {
	const id = process.env.GOOGLE_CLIENT_ID;
	const secret = process.env.GOOGLE_CLIENT_SECRET;
	if (!id || !secret) throw new Error("Google isn't configured (GOOGLE_CLIENT_ID/SECRET)");
	return { id, secret };
}

/** Where the consent screen returns to. */
export const redirectUri = (origin: string) => `${origin}/api/calendar/google/callback`;

export function consentUrl(origin: string, state: string, loginHint?: string): string {
	const params = new URLSearchParams({
		client_id: client().id,
		redirect_uri: redirectUri(origin),
		response_type: "code",
		scope: SCOPES.join(" "),
		access_type: "offline",
		// Always ask: Google only sends a refresh token on a fresh consent.
		prompt: "consent",
		include_granted_scopes: "true",
		state,
	});
	if (loginHint) params.set("login_hint", loginHint);
	return `${AUTH}?${params}`;
}

type Tokens = {
	access_token: string;
	expires_in: number;
	refresh_token?: string;
	scope?: string;
};

export async function exchangeCode(code: string, origin: string) {
	const { id, secret } = client();
	const tokens = await call<Tokens>(TOKEN, {
		method: "POST",
		headers: { "content-type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams({
			code,
			client_id: id,
			client_secret: secret,
			redirect_uri: redirectUri(origin),
			grant_type: "authorization_code",
		}),
	});
	const me = await call<{ email?: string }>(USERINFO, {
		headers: { authorization: `Bearer ${tokens.access_token}` },
	});
	return { ...tokens, email: me.email ?? "" };
}

/** Gives the grant back to Google (disconnect). Best effort. */
export async function revoke(refreshToken: string) {
	await call(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(refreshToken)}`, {
		method: "POST",
	}).catch(() => undefined);
}

type Account = typeof googleAccounts.$inferSelect;

/** A live access token for the account, refreshed (and saved) when it's about to run out. */
export async function tokenFor(account: Account): Promise<string> {
	const fresh =
		account.accessToken &&
		account.accessExpiresAt &&
		account.accessExpiresAt.getTime() > Date.now() + 60_000;
	if (fresh && account.accessToken) return unseal(account.accessToken);
	const { id, secret } = client();
	const tokens = await call<Tokens>(TOKEN, {
		method: "POST",
		headers: { "content-type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams({
			client_id: id,
			client_secret: secret,
			refresh_token: unseal(account.refreshToken),
			grant_type: "refresh_token",
		}),
	});
	await db
		.update(googleAccounts)
		.set({
			accessToken: seal(tokens.access_token),
			accessExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
		})
		.where(eq(googleAccounts.workspaceId, account.workspaceId));
	return tokens.access_token;
}

/** A Calendar API client for one account's token. */
export function calendarApi(token: string) {
	const headers = { authorization: `Bearer ${token}`, "content-type": "application/json" };
	const cal = (id: string) => `${API}/calendars/${encodeURIComponent(id)}`;
	return {
		calendars: () =>
			call<{
				items: {
					id: string;
					summary: string;
					summaryOverride?: string;
					backgroundColor?: string;
					accessRole: string;
					primary?: boolean;
					hidden?: boolean;
				}[];
			}>(`${API}/users/me/calendarList?maxResults=250`, { headers }).then((r) => r.items ?? []),

		createCalendar: (summary: string, timeZone: string) =>
			call<{ id: string }>(`${API}/calendars`, {
				method: "POST",
				headers,
				body: JSON.stringify({ summary, timeZone }),
			}),

		/** Every event (each day of a repeating one apart) from `timeMin` to `timeMax`. */
		async events(
			calendarId: string,
			opts: { timeMin: string; timeMax: string; showDeleted?: boolean },
		): Promise<GoogleEvent[]> {
			const all: GoogleEvent[] = [];
			let pageToken: string | undefined;
			for (let page = 0; page < 20; page++) {
				const params = new URLSearchParams({
					timeMin: opts.timeMin,
					timeMax: opts.timeMax,
					singleEvents: "true",
					maxResults: "2500",
					showDeleted: String(opts.showDeleted ?? false),
				});
				if (pageToken) params.set("pageToken", pageToken);
				const res = await call<{ items?: GoogleEvent[]; nextPageToken?: string }>(
					`${cal(calendarId)}/events?${params}`,
					{ headers },
				);
				all.push(...(res.items ?? []));
				pageToken = res.nextPageToken;
				if (!pageToken) break;
			}
			return all;
		},

		/** seikatsu's own rows in its calendar, as written (repeats not split). */
		async mirrored(calendarId: string): Promise<GoogleEvent[]> {
			const all: GoogleEvent[] = [];
			let pageToken: string | undefined;
			for (let page = 0; page < 20; page++) {
				const params = new URLSearchParams({ maxResults: "2500", showDeleted: "true" });
				if (pageToken) params.set("pageToken", pageToken);
				const res = await call<{ items?: GoogleEvent[]; nextPageToken?: string }>(
					`${cal(calendarId)}/events?${params}`,
					{ headers },
				);
				all.push(...(res.items ?? []));
				pageToken = res.nextPageToken;
				if (!pageToken) break;
			}
			return all;
		},

		insert: (calendarId: string, body: unknown) =>
			call<GoogleEvent>(`${cal(calendarId)}/events`, {
				method: "POST",
				headers,
				body: JSON.stringify(body),
			}),

		patch: (calendarId: string, eventId: string, body: unknown) =>
			call<GoogleEvent>(`${cal(calendarId)}/events/${encodeURIComponent(eventId)}`, {
				method: "PATCH",
				headers,
				body: JSON.stringify(body),
			}),

		remove: (calendarId: string, eventId: string) =>
			call<void>(`${cal(calendarId)}/events/${encodeURIComponent(eventId)}`, {
				method: "DELETE",
				headers,
			}).catch((e) => {
				// Already gone is gone.
				if (e instanceof GoogleError && (e.status === 404 || e.status === 410)) return;
				throw e;
			}),

		/** Asks Google to tell `address` about changes to a calendar, for about a week. */
		watch: (calendarId: string, channel: { id: string; token: string; address: string }) =>
			call<{ resourceId: string; expiration: string }>(`${cal(calendarId)}/events/watch`, {
				method: "POST",
				headers,
				body: JSON.stringify({ ...channel, type: "web_hook" }),
			}),

		stop: (channel: { id: string; resourceId: string }) =>
			call<void>(`${API}/channels/stop`, {
				method: "POST",
				headers,
				body: JSON.stringify(channel),
			}).catch(() => undefined),
	};
}

export type CalendarApi = ReturnType<typeof calendarApi>;
