// What Today's list adds to a run of days (the week, the calendar): rows late from before
// today, which head today's plan, and rows put off with "Later", on the day they come back.
// Server-only: reads the agenda.

import { loadAgenda } from "@/features/home/lib/agenda";
import { buildQueue, isAppRow } from "@/features/home/lib/queue";
import type { Money, WeekEntry } from "@/features/week/lib/week";
import type { Workspace } from "@/lib/session";

export type Extras = {
	carried: WeekEntry[];
	later: (WeekEntry & { date: string })[];
};

const NONE: Extras = { carried: [], later: [] };

export async function loadExtras(
	ws: Workspace,
	today: string,
	days: string[],
	money: Money,
): Promise<Extras> {
	// Days all behind today hold nothing late or put off.
	if ((days[days.length - 1] ?? "") < today) return NONE;
	const agenda = await loadAgenda(ws, today);
	// What's late from before today, as Today lists it: it doesn't drop off the days.
	const carried: WeekEntry[] = days.includes(today)
		? buildQueue(agenda, today, money)
				.filter(isAppRow)
				.filter((q) => q.tone === "overdue")
				.map((q) => {
					const cardId = q.app === "/seiryu" ? q.key.slice("seiryu:".length) : null;
					return {
						key: cardId ? `seiryu:due:${cardId}` : `late:${q.key}`,
						app: q.app,
						title: q.title,
						note: q.note,
						href: q.href,
						card: cardId ? { id: cardId, title: q.title } : undefined,
					};
				})
		: [];
	// Put off with "Later": back on its day, named as the list names it now.
	const rows = new Map(
		buildQueue({ ...agenda, snoozed: null }, today, money).map((q) => [q.key, q]),
	);
	const later = (agenda.snoozed ?? []).flatMap((s) => {
		const q = rows.get(s.key);
		// Events are on the days already, on their own.
		if (!q || !isAppRow(q) || !days.includes(s.until)) return [];
		return [
			{
				date: s.until,
				key: `later:${q.key}`,
				app: q.app,
				title: q.title,
				note: `Put off · ${q.note}`,
				href: q.href,
			},
		];
	});
	return { carried, later };
}
