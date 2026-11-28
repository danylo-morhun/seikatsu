// Repeating cards don't pile up: one left undone past its next step moves to that step, so a
// missed daily chore is today's, not "5 days overdue". No session — the daily cron runs it.

import {
	and,
	db,
	eq,
	isNotNull,
	isNull,
	notificationPrefs,
	seiryuCards,
	seiryuProjects,
} from "@seikatsu/db";
import { reminderAt } from "@/features/seiryu/lib/reminder";
import { caughtUp } from "@/features/seiryu/lib/repeat";
import { dayIn } from "@/lib/timezone";

/** Moves every late repeating card to its latest step by its workspace's day; returns how many. */
export async function catchUpRepeats() {
	const rows = await db
		.select({
			id: seiryuCards.id,
			dueDate: seiryuCards.dueDate,
			dueTime: seiryuCards.dueTime,
			remindMinutes: seiryuCards.remindMinutes,
			every: seiryuCards.repeatEvery,
			unit: seiryuCards.repeatUnit,
			timeZone: notificationPrefs.timeZone,
		})
		.from(seiryuCards)
		.innerJoin(seiryuProjects, eq(seiryuCards.projectId, seiryuProjects.id))
		.leftJoin(notificationPrefs, eq(notificationPrefs.workspaceId, seiryuProjects.workspaceId))
		.where(
			and(
				isNotNull(seiryuCards.repeatEvery),
				isNotNull(seiryuCards.dueDate),
				eq(seiryuCards.repeatFromDone, false),
				isNull(seiryuCards.doneOn),
				isNull(seiryuCards.archivedAt),
			),
		);
	let moved = 0;
	for (const card of rows) {
		if (!card.every || !card.unit || !card.dueDate) continue;
		const zone = safeZone(card.timeZone);
		const due = caughtUp(
			{ every: card.every, unit: card.unit, fromDone: false },
			card.dueDate,
			dayIn(zone),
		);
		if (!due) continue;
		const next = { dueDate: due, dueTime: card.dueTime, remindMinutes: card.remindMinutes };
		await db
			.update(seiryuCards)
			.set({ dueDate: due, remindAt: reminderAt(next, zone) })
			.where(eq(seiryuCards.id, card.id));
		moved++;
	}
	return moved;
}

function safeZone(timeZone: string | null) {
	try {
		dayIn(timeZone ?? "UTC");
		return timeZone ?? "UTC";
	} catch {
		return "UTC";
	}
}
