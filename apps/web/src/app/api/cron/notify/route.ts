import { notifyAisha } from "@/features/aisha/lib/notify";
import { notifyKeizoku } from "@/features/keizoku/lib/notify";
import {
	notifyKurojiBudget,
	notifyKurojiRecurring,
	notifyKurojiWeekly,
} from "@/features/kuroji/lib/notify";
import { notifyKyuu } from "@/features/kyuu/lib/notify";
import type { Notifier } from "@/features/pwa/lib/notifiers";
import { localClock, safeTimeZone } from "@/features/pwa/lib/schedule";
import { db, eq, notificationPrefs, pushSubscriptions } from "@seikatsu/db";
import { type NextRequest, NextResponse } from "next/server";

const NOTIFIERS: Record<string, Notifier> = {
	keizoku: notifyKeizoku,
	kyuu: notifyKyuu,
	aisha: notifyAisha,
	kurojiRecurring: notifyKurojiRecurring,
	kurojiBudget: notifyKurojiBudget,
	kurojiWeekly: notifyKurojiWeekly,
};

// Every 15 minutes from cron-job.org, with GitHub Actions (.github/workflows/notify.yml) as a
// throttled backup — Vercel Hobby crons run once a day (docs/ops/runbook.md). Each notifier
// decides from the user's local clock whether it's due; the notification log keeps a late or
// repeated run from sending twice. Guarded by CRON_SECRET.
export async function GET(req: NextRequest) {
	const secret = process.env.CRON_SECRET;
	if (!secret) {
		return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
	}
	if (req.headers.get("authorization") !== `Bearer ${secret}`) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const subscribed = await db
		.selectDistinct({ prefs: notificationPrefs })
		.from(notificationPrefs)
		.innerJoin(pushSubscriptions, eq(pushSubscriptions.workspaceId, notificationPrefs.workspaceId));

	const now = new Date();
	const sent: Record<string, number> = {};
	const failures: { workspaceId: string; notifier: string; error: string }[] = [];
	for (const { prefs } of subscribed) {
		const ctx = {
			workspaceId: prefs.workspaceId,
			prefs,
			clock: localClock(safeTimeZone(prefs.timeZone), now),
		};
		for (const [name, notify] of Object.entries(NOTIFIERS)) {
			try {
				sent[name] = (sent[name] ?? 0) + (await notify(ctx));
			} catch (e) {
				failures.push({
					workspaceId: prefs.workspaceId,
					notifier: name,
					error: e instanceof Error ? e.message : "unknown",
				});
			}
		}
	}

	return NextResponse.json({ workspaces: subscribed.length, sent, failures });
}
