"use server";

import { auth } from "@/auth";
import { getWorkspace } from "@/features/kuroji/actions/workspace";
import { generateKeyBetween } from "@/features/seiryu/lib/position";
import {
	createColumnSchema,
	deleteColumnSchema,
	reorderColumnSchema,
	updateColumnSchema,
} from "@/features/seiryu/lib/seiryu-schemas";
import { and, asc, db, eq, seiryuColumns, seiryuProjects } from "@seikatsu/db";
import { revalidatePath } from "next/cache";

async function getAuthedWorkspace() {
	const session = await auth();
	if (!session?.user?.id) throw new Error("Unauthorized");
	const workspace = await getWorkspace(session.user.id);
	if (!workspace) throw new Error("Workspace not found");
	return { workspace };
}

async function assertProjectOwnership(projectId: string, workspaceId: string) {
	const [project] = await db
		.select({ id: seiryuProjects.id })
		.from(seiryuProjects)
		.where(and(eq(seiryuProjects.id, projectId), eq(seiryuProjects.workspaceId, workspaceId)))
		.limit(1);
	return project ?? null;
}

export async function getColumns(projectId: string) {
	const { workspace } = await getAuthedWorkspace();

	const project = await assertProjectOwnership(projectId, workspace.id);
	if (!project) throw new Error("Forbidden");

	return db
		.select()
		.from(seiryuColumns)
		.where(eq(seiryuColumns.projectId, projectId))
		.orderBy(asc(seiryuColumns.position));
}

export async function createColumn(
	input: unknown,
): Promise<{ error: string } | { success: true; data: { id: string; position: string } }> {
	const { workspace } = await getAuthedWorkspace();

	const parsed = createColumnSchema.safeParse(input);
	if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

	const { projectId, name, color } = parsed.data;

	const project = await assertProjectOwnership(projectId, workspace.id);
	if (!project) return { error: "Forbidden" };

	const existing = await db
		.select({ position: seiryuColumns.position })
		.from(seiryuColumns)
		.where(eq(seiryuColumns.projectId, projectId))
		.orderBy(asc(seiryuColumns.position));

	const lastPos = existing.at(-1)?.position ?? null;
	const position = generateKeyBetween(lastPos, null);

	const [column] = await db
		.insert(seiryuColumns)
		.values({ projectId, name, color, position })
		.returning({ id: seiryuColumns.id });

	if (!column) return { error: "Failed to create column" };

	revalidatePath(`/seiryu/${projectId}`);
	return { success: true, data: { id: column.id, position } };
}

export async function updateColumn(input: unknown): Promise<{ error: string } | { success: true }> {
	const { workspace } = await getAuthedWorkspace();

	const parsed = updateColumnSchema.safeParse(input);
	if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

	const { columnId, ...updates } = parsed.data;

	const [col] = await db
		.select({ projectId: seiryuColumns.projectId })
		.from(seiryuColumns)
		.where(eq(seiryuColumns.id, columnId))
		.limit(1);

	if (!col) return { error: "Column not found" };

	const project = await assertProjectOwnership(col.projectId, workspace.id);
	if (!project) return { error: "Forbidden" };

	await db.update(seiryuColumns).set(updates).where(eq(seiryuColumns.id, columnId));

	revalidatePath(`/seiryu/${col.projectId}`);
	return { success: true };
}

export async function deleteColumn(input: unknown): Promise<{ error: string } | { success: true }> {
	const { workspace } = await getAuthedWorkspace();

	const parsed = deleteColumnSchema.safeParse(input);
	if (!parsed.success) return { error: "Invalid input" };

	const { columnId } = parsed.data;

	const [col] = await db
		.select({ projectId: seiryuColumns.projectId })
		.from(seiryuColumns)
		.where(eq(seiryuColumns.id, columnId))
		.limit(1);

	if (!col) return { error: "Column not found" };

	const project = await assertProjectOwnership(col.projectId, workspace.id);
	if (!project) return { error: "Forbidden" };

	await db.delete(seiryuColumns).where(eq(seiryuColumns.id, columnId));

	revalidatePath(`/seiryu/${col.projectId}`);
	return { success: true };
}

export async function reorderColumns(
	input: unknown,
): Promise<{ error: string } | { success: true }> {
	const { workspace } = await getAuthedWorkspace();

	const parsed = reorderColumnSchema.safeParse(input);
	if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

	const { columnId, newPosition } = parsed.data;

	const [col] = await db
		.select({ projectId: seiryuColumns.projectId })
		.from(seiryuColumns)
		.where(eq(seiryuColumns.id, columnId))
		.limit(1);

	if (!col) return { error: "Column not found" };

	const project = await assertProjectOwnership(col.projectId, workspace.id);
	if (!project) return { error: "Forbidden" };

	await db.update(seiryuColumns).set({ position: newPosition }).where(eq(seiryuColumns.id, columnId));

	revalidatePath(`/seiryu/${col.projectId}`);
	return { success: true };
}
