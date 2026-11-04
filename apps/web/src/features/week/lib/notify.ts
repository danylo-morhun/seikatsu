// Sunday evening: the week in one line, opening the week view. Off unless switched on in
// Settings → Notifications (prefs.weekRecap).

import { db, eq, workspaces } from "@seikatsu/db";
import { money } from "@/features/home/lib/format";
import type { Notifier } from "@/features/pwa/lib/notifiers";
import { sendOnce } from "@/features/pwa/lib/push";
import { isTimeDue } from "@/features/pwa/lib/schedule";
import { getWeekData } from "@/features/week/lib/data";
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
	if (!line) return 0;

	const sent = await sendOnce(workspaceId, `week:recap:${clock.day}`, {
		title: "Your week",
		body: line,
		url: "/week",
		tag: "week-recap",
	});
	return sent ? 1 : 0;
};
