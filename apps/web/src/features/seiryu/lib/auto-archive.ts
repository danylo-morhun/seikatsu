// Finished cards leave the board on their own: a week after they were done they go to the
// archive (restorable), so a finish column shows the week's wins, not a pile. No session —
// the daily cron runs it for every workspace.

import {
	and,
	db,
	eq,
	inArray,
	isNotNull,
	isNull,
	lt,
	seiryuCards,
	seiryuColumns,
} from "@seikatsu/db";
import { addDays } from "@/features/seiryu/lib/filters";

/** Days a finished card stays in its finish column. */
export const FINISHED_KEEP_DAYS = 7;

/** Archives every card done more than FINISHED_KEEP_DAYS before `today`; returns how many. */
export async function archiveFinishedCards(today: string, now = new Date()) {
	const before = addDays(today, -FINISHED_KEEP_DAYS);
	const finishColumns = db
		.select({ id: seiryuColumns.id })
		.from(seiryuColumns)
		.where(eq(seiryuColumns.isDone, true));
	const rows = await db
		.update(seiryuCards)
		.set({ archivedAt: now })
		.where(
			and(
				isNull(seiryuCards.archivedAt),
				isNotNull(seiryuCards.doneOn),
				lt(seiryuCards.doneOn, before),
				inArray(seiryuCards.columnId, finishColumns),
			),
		)
		.returning({ id: seiryuCards.id });
	return rows.length;
}
