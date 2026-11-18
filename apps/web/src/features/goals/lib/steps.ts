// Each goal's next step: the first open card of the projects it gathers, and where a new one
// goes. Plain server module; takes a workspace id (Week, the morning and Goals share it).

import {
	and,
	asc,
	db,
	eq,
	goalLinks,
	goals,
	inArray,
	isNull,
	seiryuCards,
	seiryuColumns,
	seiryuProjects,
} from "@seikatsu/db";

export type NextStep = {
	card: { id: string; title: string; dueDate: string | null; projectId: string } | null;
	/** Where "Add next step" puts a card: the project's first lane. */
	project: { id: string; name: string; firstColumnId: string | null };
};

/** Open goals' Seiryu projects, by project id → the goal's name. */
export async function readGoalProjects(workspaceId: string): Promise<Map<string, string>> {
	const rows = await db
		.select({ projectId: goalLinks.refId, name: goals.name })
		.from(goalLinks)
		.innerJoin(goals, eq(goals.id, goalLinks.goalId))
		.where(
			and(
				eq(goals.workspaceId, workspaceId),
				isNull(goals.archivedAt),
				eq(goalLinks.kind, "project"),
			),
		)
		.orderBy(asc(goals.position));
	const out = new Map<string, string>();
	for (const r of rows) if (r.projectId && !out.has(r.projectId)) out.set(r.projectId, r.name);
	return out;
}

/** For each project: its first open card (soonest due first, then board order) and first lane. */
export async function readNextSteps(
	workspaceId: string,
	projectIds: string[],
): Promise<Map<string, NextStep>> {
	if (projectIds.length === 0) return new Map();
	const [projects, columns, cards] = await Promise.all([
		db
			.select({ id: seiryuProjects.id, name: seiryuProjects.name })
			.from(seiryuProjects)
			.where(
				and(
					inArray(seiryuProjects.id, projectIds),
					eq(seiryuProjects.workspaceId, workspaceId),
					isNull(seiryuProjects.archivedAt),
				),
			),
		db
			.select({
				id: seiryuColumns.id,
				projectId: seiryuColumns.projectId,
				isDone: seiryuColumns.isDone,
			})
			.from(seiryuColumns)
			.where(inArray(seiryuColumns.projectId, projectIds))
			.orderBy(asc(seiryuColumns.position)),
		db
			.select({
				id: seiryuCards.id,
				title: seiryuCards.title,
				dueDate: seiryuCards.dueDate,
				projectId: seiryuCards.projectId,
			})
			.from(seiryuCards)
			.innerJoin(seiryuColumns, eq(seiryuColumns.id, seiryuCards.columnId))
			.where(
				and(
					inArray(seiryuCards.projectId, projectIds),
					isNull(seiryuCards.archivedAt),
					eq(seiryuColumns.isDone, false),
				),
			)
			.orderBy(asc(seiryuColumns.position), asc(seiryuCards.position)),
	]);
	// Soonest due first, undated after, each in board order (a stable sort keeps it).
	cards.sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"));
	const out = new Map<string, NextStep>();
	for (const p of projects) {
		const first = columns.find((c) => c.projectId === p.id && !c.isDone);
		out.set(p.id, {
			card: cards.find((c) => c.projectId === p.id) ?? null,
			project: { id: p.id, name: p.name, firstColumnId: first?.id ?? null },
		});
	}
	return out;
}
