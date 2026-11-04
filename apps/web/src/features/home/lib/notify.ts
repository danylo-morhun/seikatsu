// Morning: Today's list in one push, at the user's morning time. Built from the same agenda
// as the page (lib/agenda + lib/queue), so the push and Today never disagree. Replaces the
// per-app morning briefs; Aisha's "tell once" alerts and the evening habits stay their own.

import { db, eq, workspaces } from "@seikatsu/db";
import { readAgenda } from "@/features/home/lib/agenda";
import { money } from "@/features/home/lib/format";
import { buildQueue, type QueueItem } from "@/features/home/lib/queue";
import type { Notifier } from "@/features/pwa/lib/notifiers";
import { sendOnce } from "@/features/pwa/lib/push";
import { isTimeDue } from "@/features/pwa/lib/schedule";

/** Lines named in the push; the rest are counted. */
const SHOWN = 3;

export function morningBrief(items: QueueItem[]): { title: string; body: string } | null {
	if (items.length === 0) return null;
	const late = items.filter((i) => i.tone === "overdue").length;
	const title =
		items.length === 1
			? "1 thing waiting today"
			: `${items.length} things waiting today${late > 0 ? `, ${late} late` : ""}`;
	const named = items.slice(0, SHOWN).map((i) => i.title);
	const more = items.length - named.length;
	return { title, body: [...named, more > 0 && `+${more} more`].filter(Boolean).join(" · ") };
}

export const notifyToday: Notifier = async ({ workspaceId, prefs, clock }) => {
	if (!prefs.morningBrief || !isTimeDue(prefs.morningTime, clock)) return 0;
	const [ws] = await db.select().from(workspaces).where(eq(workspaces.id, workspaceId));
	if (!ws) return 0;
	const items = buildQueue(await readAgenda(ws, clock.day), clock.day, money);
	const brief = morningBrief(items);
	if (!brief) return 0;
	const sent = await sendOnce(workspaceId, `today:${clock.day}`, {
		...brief,
		url: "/",
		tag: "today-morning",
	});
	return sent ? 1 : 0;
};
