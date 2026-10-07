// The user's calendar day, resolved on the server. Not a "use server" module.
// The browser reports its IANA zone via the `tz` cookie (TimezoneSync); before that exists,
// Vercel's geo header is a good guess. Day-based features (Keizoku) render with this instead
// of fetching from the client after hydration.

import { cookies, headers } from "next/headers";

export const TZ_COOKIE = "tz";

function isValidZone(zone: string | undefined): zone is string {
	if (!zone) return false;
	try {
		new Intl.DateTimeFormat("en-US", { timeZone: zone });
		return true;
	} catch {
		return false;
	}
}

export async function getUserTimeZone(): Promise<string> {
	const [cookieStore, headerStore] = await Promise.all([cookies(), headers()]);
	const fromCookie = cookieStore.get(TZ_COOKIE)?.value;
	if (isValidZone(fromCookie)) return fromCookie;
	const fromGeo = headerStore.get("x-vercel-ip-timezone") ?? undefined;
	return isValidZone(fromGeo) ? fromGeo : "UTC";
}

/** YYYY-MM-DD in the user's time zone. */
export async function getUserToday(): Promise<string> {
	const timeZone = await getUserTimeZone();
	// en-CA formats as YYYY-MM-DD.
	return new Intl.DateTimeFormat("en-CA", {
		timeZone,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	}).format(new Date());
}
