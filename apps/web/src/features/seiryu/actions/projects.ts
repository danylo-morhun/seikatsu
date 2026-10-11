"use server";

import { requireWorkspace } from "@/features/seiryu/actions/guard";
import { DEFAULT_COLUMNS, isDoneColumn } from "@/features/seiryu/lib/constants";
import { generateKeyBetween, generateNKeysBetween } from "@/features/seiryu/lib/position";
import {
	createProjectSchema,
	deleteProjectSchema,
	reorderProjectsSchema,
	updateProjectSchema,
} from "@/features/seiryu/lib/seiryu-schemas";
import {
	and,
	asc,
	count,
	db,
	desc,
	eq,
	isNull,
	seiryuCards,
	seiryuColumns,
	seiryuProjects,
} from "@seikatsu/db";
import { revalidatePath } from "next/cache";
import { cache } from "react";

// Layout and page both need the list; cache() makes it one query per request.
const listProjects = cache((workspaceId: string) =>
	db
		.select()
		.from(seiryuProjects)
		.where(eq(seiryuProjects.workspaceId, workspaceId))
		.orderBy(asc(seiryuProjects.position)),
);

export async function getProjects() {
	const workspace = await requireWorkspace();
	return listProjects(workspace.id);
}

/** Open cards per project: live cards outside a "Done" column. */
export async function getOpenCardCounts(): Promise<Record<string, number>> {
	const workspace = await requireWorkspace();

	const rows = await db
		.select({ projectId: seiryuColumns.projectId, name: seiryuColumns.name, total: count() })
		.from(seiryuCards)
		.innerJoin(seiryuColumns, eq(seiryuCards.columnId, seiryuColumns.id))
		.innerJoin(seiryuProjects, eq(seiryuColumns.projectId, seiryuProjects.id))
		.where(and(eq(seiryuProjects.workspaceId, workspace.id), isNull(seiryuCards.archivedAt)))
		.groupBy(seiryuColumns.id, seiryuColumns.projectId, seiryuColumns.name);

	const counts: Record<string, number> = {};
	for (const row of rows) {
		if (isDoneColumn(row.name)) continue;
		counts[row.projectId] = (counts[row.projectId] ?? 0) + row.total;
	}
	return counts;
}

export async function createProject(
	input: unknown,
): Promise<{ error: string } | { success: true; data: { id: string } }> {
	const workspace = await requireWorkspace();

	const parsed = createProjectSchema.safeParse(input);
	if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

	const { name, description, color } = parsed.data;

	const [last] = await db
		.select({ position: seiryuProjects.position })
		.from(seiryuProjects)
		.where(eq(seiryuProjects.workspaceId, workspace.id))
		.orderBy(desc(seiryuProjects.position))
		.limit(1);
	const position = generateKeyBetween(last?.position ?? null, null);

	const project = await db.transaction(async (tx) => {
		const [created] = await tx
			.insert(seiryuProjects)
			.values({ workspaceId: workspace.id, name, description, color, position })
			.returning({ id: seiryuProjects.id });
		if (!created) return null;

		const columnPositions = generateNKeysBetween(null, null, DEFAULT_COLUMNS.length);
		await tx.insert(seiryuColumns).values(
			DEFAULT_COLUMNS.map((columnName, i) => ({
				projectId: created.id,
				name: columnName,
				position: columnPositions[i] as string,
			})),
		);
		return created;
	});

	if (!project) return { error: "Failed to create project" };

	revalidatePath("/seiryu", "layout");
	revalidatePath("/settings/seiryu");
	return { success: true, data: { id: project.id } };
}

export async function updateProject(
	input: unknown,
): Promise<{ error: string } | { success: true }> {
	const workspace = await requireWorkspace();

	const parsed = updateProjectSchema.safeParse(input);
	if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

	const { projectId, ...updates } = parsed.data;

	const [updated] = await db
		.update(seiryuProjects)
		.set(updates)
		.where(and(eq(seiryuProjects.id, projectId), eq(seiryuProjects.workspaceId, workspace.id)))
		.returning({ id: seiryuProjects.id });
	if (!updated) return { error: "Project not found" };

	revalidatePath("/seiryu", "layout");
	revalidatePath("/settings/seiryu");
	return { success: true };
}

export async function deleteProject(
	input: unknown,
): Promise<{ error: string } | { success: true }> {
	const workspace = await requireWorkspace();

	const parsed = deleteProjectSchema.safeParse(input);
	if (!parsed.success) return { error: "Invalid input" };

	const [deleted] = await db
		.delete(seiryuProjects)
		.where(
			and(
				eq(seiryuProjects.id, parsed.data.projectId),
				eq(seiryuProjects.workspaceId, workspace.id),
			),
		)
		.returning({ id: seiryuProjects.id });
	if (!deleted) return { error: "Project not found" };

	revalidatePath("/seiryu", "layout");
	revalidatePath("/settings/seiryu");
	return { success: true };
}

export async function reorderProject(
	input: unknown,
): Promise<{ error: string } | { success: true }> {
	const workspace = await requireWorkspace();

	const parsed = reorderProjectsSchema.safeParse(input);
	if (!parsed.success) return { error: "Invalid input" };

	const [updated] = await db
		.update(seiryuProjects)
		.set({ position: parsed.data.newPosition })
		.where(
			and(
				eq(seiryuProjects.id, parsed.data.projectId),
				eq(seiryuProjects.workspaceId, workspace.id),
			),
		)
		.returning({ id: seiryuProjects.id });
	if (!updated) return { error: "Project not found" };

	revalidatePath("/seiryu", "layout");
	revalidatePath("/settings/seiryu");
	return { success: true };
}
