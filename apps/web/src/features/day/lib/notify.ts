// Evening: one push at the evening time to close the day — what's left of the picks, habits
// still open, payments to add. Nothing once the day is closed.

import { db, eq, workspaces } from "@seikatsu/db";
import { loadDay, readPlan } from "@/features/day/lib/data";
import { closeLine } from "@/features/day/lib/day";
import { loadAgenda } from "@/features/home/lib/agenda";
import { money } from "@/features/home/lib/format";
import { listDueToday } from "@/features/keizoku/lib/due-today";
import type { Notifier } from "@/features/pwa/lib/notifiers";
import { sendOnce } from "@/features/pwa/lib/push";
import { isTimeDue } from "@/features/pwa/lib/schedule";

export const notifyEvening: Notifier = async ({ workspaceId, prefs, clock }) => {
	if (!prefs.eveningClose || !isTimeDue(prefs.eveningTime, clock)) return 0;
	const plan = await readPlan(workspaceId, clock.day);
	if (plan?.closedAt) return 0;
	const [ws] = await db.select().from(workspaces).where(eq(workspaces.id, workspaceId));
	if (!ws) return 0;
	const [day, agenda, habits] = await Promise.all([
		loadDay(ws, clock.day, money),
		loadAgenda(ws, clock.day),
		listDueToday(workspaceId, clock.day),
	]);
	const body = closeLine({
		picks: plan?.plannedAt
			? { done: day.picks.filter((p) => p.done).length, of: day.picks.length }
			: null,
		habitsLeft: habits.filter((h) => !h.done).length,
		payments: agenda.money?.captures ?? 0,
	});
	const sent = await sendOnce(workspaceId, `evening:${clock.day}`, {
		title: "Close the day",
		body,
		url: "/evening",
		tag: "day-evening",
	});
	return sent ? 1 : 0;
};
