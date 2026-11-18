// Sunday evening: the week in one line, opening next week's plan (or the week view once it's
// planned). Off unless switched on in
// Settings → Notifications (prefs.weekRecap).

import { db, eq, workspaces } from "@seikatsu/db";
import { money } from "@/features/home/lib/format";
import type { Notifier } from "@/features/pwa/lib/notifiers";
import { sendOnce } from "@/features/pwa/lib/push";
import { isTimeDue } from "@/features/pwa/lib/schedule";
import { addDays } from "@/features/seiryu/lib/filters";
import { getWeekData } from "@/features/week/lib/data";
import { readWeekPlan } from "@/features/week/lib/plan-data";
import { buildWeek, weekLine, weekOf } from "@/features/week/lib/week";

const SUNDAY = 7;
const AT = "18:00";

export const notifyWeek: Notifier = async ({ workspaceId, prefs, clock }) => {
	// The old Monday money summary folded in here: on if either switch is.
	const on = prefs.weekRecap || prefs.kurojiWeekly;
	if (!on || clock.weekday !== SUNDAY || !isTimeDue(AT, clock)) return 0;

	const [ws] = await db
		.select({ baseCurrency: workspaces.baseCurrency })
		.from(workspaces)
		.where(eq(workspaces.id, workspaceId));
	if (!ws) return 0;
	const week = weekOf(clock.day);
	const data = await getWeekData({ id: workspaceId }, clock.day, week);
	const { totals } = buildWeek(data, clock.day, week, (n, c = ws.baseCurrency) => money(n, c));
	const line = weekLine(totals, (n) => money(n, ws.baseCurrency));
	// The week ahead not planned yet: the push opens its plan, which starts with this look back.
	const ahead = await readWeekPlan(workspaceId, addDays(clock.day, 1));
	const plan = !ahead?.plannedAt;
	if (!line && !plan) return 0;

	const sent = await sendOnce(workspaceId, `week:recap:${clock.day}`, {
		title: plan ? "Look back, plan next week" : "Your week",
		body: line ?? "Five minutes: how the week went, then next week's focus.",
		url: plan ? "/week/plan" : "/week",
		tag: "week-recap",
	});
	return sent ? 1 : 0;
};
