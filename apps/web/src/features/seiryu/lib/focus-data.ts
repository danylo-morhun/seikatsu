// Focus's read: every open card of the user's live projects, with what the list shows.
// Plain server module (not "use server"): the page and Claude's tool call it.

import {
	and,
	asc,
	db,
	eq,
	isNull,
	seiryuCards,
	seiryuChecklistItems,
	seiryuColumns,
	seiryuGroups,
	seiryuProjects,
} from "@seikatsu/db";
import { requireWorkspace } from "@/features/seiryu/actions/guard";
import { buildFocus, type FocusCard } from "@/features/seiryu/lib/focus";
import { shortTime } from "@/features/seiryu/lib/reminder";
import { getUserToday } from "@/lib/timezone";

export async function getFocus() {
	const workspace = await requireWorkspace();
	const [columns, cards, items, today] = await Promise.all([
		db
			.select({
				id: seiryuColumns.id,
				projectId: seiryuColumns.projectId,
				isDone: seiryuColumns.isDone,
			})
			.from(seiryuColumns)
			.innerJoin(seiryuProjects, eq(seiryuProjects.id, seiryuColumns.projectId))
			.where(eq(seiryuProjects.workspaceId, workspace.id))
			.orderBy(asc(seiryuColumns.position)),
		db
			.select({
				id: seiryuCards.id,
				title: seiryuCards.title,
				projectId: seiryuCards.projectId,
				projectName: seiryuProjects.name,
				projectColor: seiryuProjects.color,
				columnId: seiryuCards.columnId,
				position: seiryuCards.position,
				groupName: seiryuGroups.name,
				priority: seiryuCards.priority,
				dueDate: seiryuCards.dueDate,
				dueTime: seiryuCards.dueTime,
				startOn: seiryuCards.startOn,
				blockedById: seiryuCards.blockedById,
				repeatUnit: seiryuCards.repeatUnit,
				movedAt: seiryuCards.movedAt,
			})
			.from(seiryuCards)
			.innerJoin(seiryuProjects, eq(seiryuProjects.id, seiryuCards.projectId))
			.innerJoin(seiryuColumns, eq(seiryuColumns.id, seiryuCards.columnId))
			.leftJoin(seiryuGroups, eq(seiryuGroups.id, seiryuCards.groupId))
			.where(
				and(
					eq(seiryuProjects.workspaceId, workspace.id),
					isNull(seiryuProjects.archivedAt),
					isNull(seiryuCards.archivedAt),
					eq(seiryuColumns.isDone, false),
				),
			),
		db
			.select({
				cardId: seiryuChecklistItems.cardId,
				isCompleted: seiryuChecklistItems.isCompleted,
			})
			.from(seiryuChecklistItems)
			.innerJoin(seiryuCards, eq(seiryuCards.id, seiryuChecklistItems.cardId))
			.innerJoin(seiryuProjects, eq(seiryuProjects.id, seiryuCards.projectId))
			.where(and(eq(seiryuProjects.workspaceId, workspace.id), isNull(seiryuCards.archivedAt))),
		getUserToday(),
	]);

	// Per project: its first open lane (work not started) and its first finish lane.
	const firstOpen = new Map<string, string>();
	const firstDone = new Map<string, string>();
	for (const c of columns) {
		const into = c.isDone ? firstDone : firstOpen;
		if (!into.has(c.projectId)) into.set(c.projectId, c.id);
	}
	const checklist = new Map<string, { done: number; total: number }>();
	for (const i of items) {
		const t = checklist.get(i.cardId) ?? { done: 0, total: 0 };
		t.total += 1;
		if (i.isCompleted) t.done += 1;
		checklist.set(i.cardId, t);
	}

	// A card waits while the card it names is still open (in this list).
	const openTitles = new Map(cards.map((c) => [c.id, c.title]));
	const rows: FocusCard[] = cards.map(({ repeatUnit, movedAt, dueTime, blockedById, ...c }) => ({
		...c,
		waitingOn: blockedById ? (openTitles.get(blockedById) ?? null) : null,
		dueTime: shortTime(dueTime),
		repeats: repeatUnit !== null,
		movedAt: movedAt.toISOString(),
		started: firstOpen.get(c.projectId) !== c.columnId,
		checklist: checklist.get(c.id) ?? null,
		doneColumnId: firstDone.get(c.projectId) ?? null,
	}));
	return { today, sections: buildFocus(rows, today) };
}
