// Shared ownership guards for seiryu server actions.
// Not a "use server" module — these are helpers called inside server actions.

import { type Workspace, getCurrentWorkspace } from "@/lib/session";
import {
	and,
	db,
	eq,
	seiryuCards,
	seiryuChecklistItems,
	seiryuColumns,
	seiryuLabels,
	seiryuProjects,
} from "@seikatsu/db";
import { cache } from "react";

/** The signed-in user's workspace; throws when signed out (actions are never public). */
export async function requireWorkspace(): Promise<Workspace> {
	const workspace = await getCurrentWorkspace();
	if (!workspace) throw new Error("Unauthorized");
	return workspace;
}

/**
 * True if the project belongs to the workspace. Cached per request: the board page loads
 * columns, cards and labels in parallel, and each checks the same project.
 */
export const isOwnedProject = cache(async (projectId: string, workspaceId: string) => {
	const [project] = await db
		.select({ id: seiryuProjects.id })
		.from(seiryuProjects)
		.where(and(eq(seiryuProjects.id, projectId), eq(seiryuProjects.workspaceId, workspaceId)))
		.limit(1);
	return project != null;
});

/** The card's project and column if it belongs to the workspace — one query. */
export async function getOwnedCard(cardId: string, workspaceId: string) {
	const [card] = await db
		.select({ projectId: seiryuCards.projectId, columnId: seiryuCards.columnId })
		.from(seiryuCards)
		.innerJoin(seiryuProjects, eq(seiryuProjects.id, seiryuCards.projectId))
		.where(and(eq(seiryuCards.id, cardId), eq(seiryuProjects.workspaceId, workspaceId)))
		.limit(1);
	return card ?? null;
}

/** The column's project if it belongs to the workspace — one query. */
export async function getOwnedColumn(columnId: string, workspaceId: string) {
	const [column] = await db
		.select({ projectId: seiryuColumns.projectId })
		.from(seiryuColumns)
		.innerJoin(seiryuProjects, eq(seiryuProjects.id, seiryuColumns.projectId))
		.where(and(eq(seiryuColumns.id, columnId), eq(seiryuProjects.workspaceId, workspaceId)))
		.limit(1);
	return column ?? null;
}

/** The checklist item's card state and project if it belongs to the workspace — one query. */
export async function getOwnedChecklistItem(itemId: string, workspaceId: string) {
	const [item] = await db
		.select({
			cardId: seiryuChecklistItems.cardId,
			isCompleted: seiryuChecklistItems.isCompleted,
			projectId: seiryuCards.projectId,
		})
		.from(seiryuChecklistItems)
		.innerJoin(seiryuCards, eq(seiryuCards.id, seiryuChecklistItems.cardId))
		.innerJoin(seiryuProjects, eq(seiryuProjects.id, seiryuCards.projectId))
		.where(and(eq(seiryuChecklistItems.id, itemId), eq(seiryuProjects.workspaceId, workspaceId)))
		.limit(1);
	return item ?? null;
}

/** The label's project if it belongs to the workspace — one query. */
export async function getOwnedLabel(labelId: string, workspaceId: string) {
	const [label] = await db
		.select({ projectId: seiryuLabels.projectId })
		.from(seiryuLabels)
		.innerJoin(seiryuProjects, eq(seiryuProjects.id, seiryuLabels.projectId))
		.where(and(eq(seiryuLabels.id, labelId), eq(seiryuProjects.workspaceId, workspaceId)))
		.limit(1);
	return label ?? null;
}
