import { randomBytes } from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { consentUrl } from "@/features/calendar/google/api";

const STATE_COOKIE = "gcal_state";

/** Starts connecting a Google account's calendars: off to Google's consent, then back. */
export async function GET(req: NextRequest) {
	const session = await auth();
	if (!session?.user?.id) return NextResponse.redirect(new URL("/", req.url));
	const origin = process.env.AUTH_URL?.replace(/\/$/, "") ?? req.nextUrl.origin;
	const state = randomBytes(24).toString("base64url");
	let url: string;
	try {
		url = consentUrl(origin, state, session.user.email ?? undefined);
	} catch {
		return NextResponse.redirect(new URL("/settings/calendar?error=config", origin));
	}
	const res = NextResponse.redirect(url);
	res.cookies.set(STATE_COOKIE, state, {
		httpOnly: true,
		secure: origin.startsWith("https://"),
		sameSite: "lax",
		path: "/api/calendar/google",
		maxAge: 600,
	});
	return res;
}
