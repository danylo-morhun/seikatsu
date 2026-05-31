"use server";

import { auth } from "@/auth";
import { getWorkspace } from "@/features/midas/actions/workspace";
import { generateKeyBetween } from "@/features/tasso/lib/position";
import {
	createColumnSchema,
	deleteColumnSchema,
	reorderColumnSchema,
	updateColumnSchema,
} from "@/features/tasso/lib/tasso-schemas";
import { and, asc, db, eq, tassoColumns, tassoProjects } from "@ethos/db";
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
		.select({ id: tassoProjects.id })
		.from(tassoProjects)
		.where(and(eq(tassoProjects.id, projectId), eq(tassoProjects.workspaceId, workspaceId)))
		.limit(1);
	return project ?? null;
}

export async function getColumns(projectId: string) {
	const { workspace } = await getAuthedWorkspace();

	const project = await assertProjectOwnership(projectId, workspace.id);
	if (!project) throw new Error("Forbidden");

	return db
		.select()
		.from(tassoColumns)
		.where(eq(tassoColumns.projectId, projectId))
		.orderBy(asc(tassoColumns.position));
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
		.select({ position: tassoColumns.position })
		.from(tassoColumns)
		.where(eq(tassoColumns.projectId, projectId))
		.orderBy(asc(tassoColumns.position));

	const lastPos = existing.at(-1)?.position ?? null;
	const position = generateKeyBetween(lastPos, null);

	const [column] = await db
		.insert(tassoColumns)
		.values({ projectId, name, color, position })
		.returning({ id: tassoColumns.id });

	if (!column) return { error: "Failed to create column" };

	revalidatePath(`/tasso/${projectId}`);
	return { success: true, data: { id: column.id, position } };
}

export async function updateColumn(input: unknown): Promise<{ error: string } | { success: true }> {
	const { workspace } = await getAuthedWorkspace();

	const parsed = updateColumnSchema.safeParse(input);
	if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

	const { columnId, ...updates } = parsed.data;

	const [col] = await db
		.select({ projectId: tassoColumns.projectId })
		.from(tassoColumns)
		.where(eq(tassoColumns.id, columnId))
		.limit(1);

	if (!col) return { error: "Column not found" };

	const project = await assertProjectOwnership(col.projectId, workspace.id);
	if (!project) return { error: "Forbidden" };

	await db.update(tassoColumns).set(updates).where(eq(tassoColumns.id, columnId));

	revalidatePath(`/tasso/${col.projectId}`);
	return { success: true };
}

export async function deleteColumn(input: unknown): Promise<{ error: string } | { success: true }> {
	const { workspace } = await getAuthedWorkspace();

	const parsed = deleteColumnSchema.safeParse(input);
	if (!parsed.success) return { error: "Invalid input" };

	const { columnId } = parsed.data;

	const [col] = await db
		.select({ projectId: tassoColumns.projectId })
		.from(tassoColumns)
		.where(eq(tassoColumns.id, columnId))
		.limit(1);

	if (!col) return { error: "Column not found" };

	const project = await assertProjectOwnership(col.projectId, workspace.id);
	if (!project) return { error: "Forbidden" };

	await db.delete(tassoColumns).where(eq(tassoColumns.id, columnId));

	revalidatePath(`/tasso/${col.projectId}`);
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
		.select({ projectId: tassoColumns.projectId })
		.from(tassoColumns)
		.where(eq(tassoColumns.id, columnId))
		.limit(1);

	if (!col) return { error: "Column not found" };

	const project = await assertProjectOwnership(col.projectId, workspace.id);
	if (!project) return { error: "Forbidden" };

	await db.update(tassoColumns).set({ position: newPosition }).where(eq(tassoColumns.id, columnId));

	revalidatePath(`/tasso/${col.projectId}`);
	return { success: true };
}
