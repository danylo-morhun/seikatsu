// Morning: Today's list in one push, at the user's morning time. Built from the same agenda
// as the page (lib/agenda + lib/queue), so the push and Today never disagree. Replaces the
// per-app morning briefs; Aisha's "tell once" alerts and the evening habits stay their own.

import { db, eq, workspaces } from "@seikatsu/db";
import { readPlan } from "@/features/day/lib/data";
import { readAgenda } from "@/features/home/lib/agenda";
import { money } from "@/features/home/lib/format";
import { buildQueue, type QueueItem } from "@/features/home/lib/queue";
import type { Notifier } from "@/features/pwa/lib/notifiers";
import { sendOnce } from "@/features/pwa/lib/push";
import { isTimeDue } from "@/features/pwa/lib/schedule";
import { MODULE_HREFS } from "@/lib/modules";

/** Lines named in the push; the rest are counted. */
const SHOWN = 3;

export function morningBrief(items: QueueItem[]): { title: string; body: string } | null {
	const tasks = items.filter((i) => !i.event);
	const events = items.filter((i) => i.event);
	if (tasks.length === 0 && events.length === 0) return null;
	const late = tasks.filter((i) => i.tone === "overdue").length;
	// The day's events, when there are any: how many, and the first at a time.
	const first = events.find((e) => e.time);
	const eventLine =
		events.length === 0
			? null
			: `${events.length === 1 ? "1 event" : `${events.length} events`}${first ? `, first ${first.time} ${first.title}` : ""}`;
	if (tasks.length === 0) return { title: "Today on the calendar", body: eventLine ?? "" };
	const title =
		tasks.length === 1
			? "1 thing waiting today"
			: `${tasks.length} things waiting today${late > 0 ? `, ${late} late` : ""}`;
	const named = tasks.slice(0, SHOWN).map((i) => i.title);
	const more = tasks.length - named.length;
	const body = [...named, more > 0 && `+${more} more`].filter(Boolean).join(" · ");
	return { title, body: eventLine ? `${body}\n${eventLine}` : body };
}

export const notifyToday: Notifier = async ({ workspaceId, prefs, clock, on = MODULE_HREFS }) => {
	if (!prefs.morningBrief || !isTimeDue(prefs.morningTime, clock)) return 0;
	const [ws] = await db.select().from(workspaces).where(eq(workspaces.id, workspaceId));
	if (!ws) return 0;
	const items = buildQueue(await readAgenda(ws, clock.day), clock.day, money);
	const brief = morningBrief(items);
	if (!brief) return 0;
	// Not planned yet: the push opens the morning's plan (with Day on).
	const planned = !on.includes("/day") || (await readPlan(workspaceId, clock.day))?.plannedAt;
	const sent = await sendOnce(workspaceId, `today:${clock.day}`, {
		...brief,
		url: planned ? "/" : "/morning",
		tag: "today-morning",
	});
	return sent ? 1 : 0;
};
