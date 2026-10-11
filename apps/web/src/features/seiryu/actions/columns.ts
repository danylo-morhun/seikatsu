"use server";

import { getOwnedColumn, isOwnedProject, requireWorkspace } from "@/features/seiryu/actions/guard";
import { generateKeyBetween } from "@/features/seiryu/lib/position";
import {
	createColumnSchema,
	deleteColumnSchema,
	reorderColumnSchema,
	updateColumnSchema,
} from "@/features/seiryu/lib/seiryu-schemas";
import { asc, db, desc, eq, seiryuColumns } from "@seikatsu/db";
import { revalidatePath } from "next/cache";

export async function getColumns(projectId: string) {
	const workspace = await requireWorkspace();
	if (!(await isOwnedProject(projectId, workspace.id))) throw new Error("Forbidden");

	return db
		.select()
		.from(seiryuColumns)
		.where(eq(seiryuColumns.projectId, projectId))
		.orderBy(asc(seiryuColumns.position));
}

export async function createColumn(
	input: unknown,
): Promise<{ error: string } | { success: true; data: { id: string; position: string } }> {
	const workspace = await requireWorkspace();

	const parsed = createColumnSchema.safeParse(input);
	if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

	const { projectId, name, color } = parsed.data;

	if (!(await isOwnedProject(projectId, workspace.id))) return { error: "Project not found" };

	const [last] = await db
		.select({ position: seiryuColumns.position })
		.from(seiryuColumns)
		.where(eq(seiryuColumns.projectId, projectId))
		.orderBy(desc(seiryuColumns.position))
		.limit(1);
	const position = generateKeyBetween(last?.position ?? null, null);

	const [column] = await db
		.insert(seiryuColumns)
		.values({ projectId, name, color, position })
		.returning({ id: seiryuColumns.id });

	if (!column) return { error: "Failed to create column" };

	revalidatePath(`/seiryu/${projectId}`);
	return { success: true, data: { id: column.id, position } };
}

export async function updateColumn(input: unknown): Promise<{ error: string } | { success: true }> {
	const workspace = await requireWorkspace();

	const parsed = updateColumnSchema.safeParse(input);
	if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

	const { columnId, ...updates } = parsed.data;

	const column = await getOwnedColumn(columnId, workspace.id);
	if (!column) return { error: "Column not found" };

	await db.update(seiryuColumns).set(updates).where(eq(seiryuColumns.id, columnId));

	// The finish line decides the open-card counts in the project list.
	if (updates.isDone !== undefined) revalidatePath("/seiryu", "layout");
	else revalidatePath(`/seiryu/${column.projectId}`);
	return { success: true };
}

export async function deleteColumn(input: unknown): Promise<{ error: string } | { success: true }> {
	const workspace = await requireWorkspace();

	const parsed = deleteColumnSchema.safeParse(input);
	if (!parsed.success) return { error: "Invalid input" };

	const column = await getOwnedColumn(parsed.data.columnId, workspace.id);
	if (!column) return { error: "Column not found" };

	await db.delete(seiryuColumns).where(eq(seiryuColumns.id, parsed.data.columnId));

	revalidatePath(`/seiryu/${column.projectId}`);
	return { success: true };
}

export async function reorderColumns(
	input: unknown,
): Promise<{ error: string } | { success: true }> {
	const workspace = await requireWorkspace();

	const parsed = reorderColumnSchema.safeParse(input);
	if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

	const { columnId, newPosition } = parsed.data;

	const column = await getOwnedColumn(columnId, workspace.id);
	if (!column) return { error: "Column not found" };

	await db
		.update(seiryuColumns)
		.set({ position: newPosition })
		.where(eq(seiryuColumns.id, columnId));

	revalidatePath(`/seiryu/${column.projectId}`);
	return { success: true };
}
