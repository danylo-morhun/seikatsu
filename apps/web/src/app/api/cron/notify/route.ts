import { db, eq, inArray, notificationPrefs, pushSubscriptions, workspaces } from "@seikatsu/db";
import * as Sentry from "@sentry/nextjs";
import { type NextRequest, NextResponse } from "next/server";
import { notifyAisha } from "@/features/aisha/lib/notify";
import { notifyCalendar } from "@/features/calendar/lib/notify";
import { notifyEvening } from "@/features/day/lib/notify";
import { notifyToday } from "@/features/home/lib/notify";
import { notifyKeizoku } from "@/features/keizoku/lib/notify";
import { notifyKurojiBudget, notifyKurojiRecurring } from "@/features/kuroji/lib/notify";
import type { Notifier } from "@/features/pwa/lib/notifiers";
import { localClock, safeTimeZone } from "@/features/pwa/lib/schedule";
import { notifySeiryu } from "@/features/seiryu/lib/notify";
import { notifyWeek } from "@/features/week/lib/notify";
import { type ModuleHref, modulesOn } from "@/lib/modules";

/** Each notifier, and the module it belongs to (none: always runs). */
const NOTIFIERS: Record<string, [Notifier, ModuleHref | null]> = {
	today: [notifyToday, null],
	evening: [notifyEvening, "/day"],
	keizoku: [notifyKeizoku, "/keizoku"],
	aisha: [notifyAisha, "/aisha"],
	kurojiRecurring: [notifyKurojiRecurring, "/kuroji"],
	kurojiBudget: [notifyKurojiBudget, "/kuroji"],
	week: [notifyWeek, "/week"],
	seiryu: [notifySeiryu, "/seiryu"],
	calendar: [notifyCalendar, null],
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

	const off = new Map(
		subscribed.length === 0
			? []
			: (
					await db
						.select({ id: workspaces.id, modulesOff: workspaces.modulesOff })
						.from(workspaces)
						.where(
							inArray(
								workspaces.id,
								subscribed.map((s) => s.prefs.workspaceId),
							),
						)
				).map((w) => [w.id, w.modulesOff]),
	);
	const now = new Date();
	const sent: Record<string, number> = {};
	const failures: { workspaceId: string; notifier: string; error: string }[] = [];
	for (const { prefs } of subscribed) {
		const ctx = {
			workspaceId: prefs.workspaceId,
			prefs,
			clock: localClock(safeTimeZone(prefs.timeZone), now),
			on: modulesOn(off.get(prefs.workspaceId) ?? []),
		};
		for (const [name, [notify, module]] of Object.entries(NOTIFIERS)) {
			if (module && !ctx.on.includes(module)) continue; // off: not sent
			try {
				sent[name] = (sent[name] ?? 0) + (await notify(ctx));
			} catch (e) {
				Sentry.captureException(e, { tags: { cron: "notify" } });
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
