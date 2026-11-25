import { db, googleAccounts } from "@seikatsu/db";
import * as Sentry from "@sentry/nextjs";
import { type NextRequest, NextResponse } from "next/server";
import { renewChannels } from "@/features/calendar/google/channels";
import { syncGoogle } from "@/features/calendar/google/sync";

// Every 15 minutes (sk-cron-google-calendar.timer): each connected account syncs both ways and
// its push channels are renewed before they run out. The webhook makes most changes arrive
// sooner; this catches what it missed. Guarded by CRON_SECRET.
export async function GET(req: NextRequest) {
	const secret = process.env.CRON_SECRET;
	if (!secret) return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
	if (req.headers.get("authorization") !== `Bearer ${secret}`)
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	const accounts = await db
		.select({ workspaceId: googleAccounts.workspaceId })
		.from(googleAccounts);
	let failed = 0;
	for (const { workspaceId } of accounts) {
		try {
			await syncGoogle(workspaceId);
			await renewChannels(workspaceId);
		} catch (e) {
			failed++;
			Sentry.captureException(e, { tags: { cron: "google-calendar" } });
		}
	}
	return NextResponse.json({ accounts: accounts.length, failed });
}
