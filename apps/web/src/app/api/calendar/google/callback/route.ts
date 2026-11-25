import { db, googleAccounts } from "@seikatsu/db";
import * as Sentry from "@sentry/nextjs";
import { after, type NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { exchangeCode } from "@/features/calendar/google/api";
import { renewChannels } from "@/features/calendar/google/channels";
import { syncGoogle } from "@/features/calendar/google/sync";
import { seal } from "@/lib/seal";
import { getCurrentWorkspace } from "@/lib/session";
import { getUserTimeZone } from "@/lib/timezone";

const STATE_COOKIE = "gcal_state";

/** Back from Google's consent: keep the account (tokens sealed), then the first sync. */
export async function GET(req: NextRequest) {
	const origin = process.env.AUTH_URL?.replace(/\/$/, "") ?? req.nextUrl.origin;
	const done = (query: string) => {
		const res = NextResponse.redirect(new URL(`/settings/calendar?${query}`, origin));
		res.cookies.delete({ name: STATE_COOKIE, path: "/api/calendar/google" });
		return res;
	};
	const session = await auth();
	if (!session?.user?.id) return NextResponse.redirect(new URL("/", origin));
	const params = req.nextUrl.searchParams;
	const state = params.get("state");
	const expected = req.cookies.get(STATE_COOKIE)?.value;
	if (!state || !expected || state !== expected) return done("error=state");
	if (params.get("error")) return done("error=denied");
	const code = params.get("code");
	if (!code) return done("error=denied");
	const [workspace, timeZone] = await Promise.all([getCurrentWorkspace(), getUserTimeZone()]);
	if (!workspace) return NextResponse.redirect(new URL("/", origin));
	try {
		const tokens = await exchangeCode(code, origin);
		if (!tokens.refresh_token) return done("error=offline");
		if (!tokens.scope?.includes("calendar")) return done("error=scope");
		const values = {
			email: tokens.email,
			refreshToken: seal(tokens.refresh_token),
			accessToken: seal(tokens.access_token),
			accessExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
			timeZone,
			lastError: null,
		};
		await db
			.insert(googleAccounts)
			.values({ workspaceId: workspace.id, ...values })
			.onConflictDoUpdate({ target: googleAccounts.workspaceId, set: values });
	} catch (e) {
		Sentry.captureException(e, { tags: { google: "callback" } });
		return done("error=exchange");
	}
	after(async () => {
		await syncGoogle(workspace.id);
		await renewChannels(workspace.id).catch((e) =>
			Sentry.captureException(e, { tags: { google: "channels" } }),
		);
	});
	return done("connected=1");
}
