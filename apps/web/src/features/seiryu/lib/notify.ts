// A card's own reminder: pushed when its `remind_at` passes (the cron runs every 15 minutes),
// with Done and "In 1 hour" buttons that answer without opening the app.

import {
	and,
	db,
	eq,
	gt,
	isNull,
	lte,
	seiryuCards,
	seiryuColumns,
	seiryuProjects,
} from "@seikatsu/db";
import type { Notifier } from "@/features/pwa/lib/notifiers";
import { sendOnce } from "@/features/pwa/lib/push";
import { DUE_WINDOW_MINUTES } from "@/features/pwa/lib/schedule";
import { addDays } from "@/features/seiryu/lib/filters";
import { dueLabel, shortTime } from "@/features/seiryu/lib/reminder";

export const notifySeiryu: Notifier = async ({ workspaceId, prefs, clock }) => {
	if (!prefs.seiryuReminders) return 0;
	const now = new Date();
	// A late or skipped run still sends within the hour; older ones are let go.
	const since = new Date(now.getTime() - DUE_WINDOW_MINUTES * 60_000);
	const due = await db
		.select({
			id: seiryuCards.id,
			title: seiryuCards.title,
			dueDate: seiryuCards.dueDate,
			dueTime: seiryuCards.dueTime,
			remindAt: seiryuCards.remindAt,
			projectId: seiryuProjects.id,
			projectName: seiryuProjects.name,
		})
		.from(seiryuCards)
		.innerJoin(seiryuProjects, eq(seiryuProjects.id, seiryuCards.projectId))
		.innerJoin(seiryuColumns, eq(seiryuColumns.id, seiryuCards.columnId))
		.where(
			and(
				eq(seiryuProjects.workspaceId, workspaceId),
				isNull(seiryuProjects.archivedAt),
				isNull(seiryuCards.archivedAt),
				eq(seiryuColumns.isDone, false),
				lte(seiryuCards.remindAt, now),
				gt(seiryuCards.remindAt, since),
			),
		);

	let sent = 0;
	for (const card of due) {
		if (!card.remindAt || !card.dueDate) continue;
		const when = dueLabel(card.dueDate, shortTime(card.dueTime), clock.day, addDays(clock.day, 1));
		const ok = await sendOnce(workspaceId, `seiryu:${card.id}:${card.remindAt.toISOString()}`, {
			title: card.title,
			body: `${when} · ${card.projectName}`,
			url: `/seiryu/${card.projectId}/${card.id}`,
			tag: `seiryu-${card.id}`,
			actUrl: `/api/seiryu/cards/${card.id}/remind`,
			actions: [
				{ action: "done", title: "Done" },
				{ action: "snooze", title: "In 1 hour" },
			],
		});
		if (ok) sent++;
	}
	return sent;
};
