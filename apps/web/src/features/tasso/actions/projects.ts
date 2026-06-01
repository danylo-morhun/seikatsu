"use server";

import { auth } from "@/auth";
import { getWorkspace } from "@/features/midas/actions/workspace";
import { DEFAULT_COLUMNS } from "@/features/tasso/lib/constants";
import { generateKeyBetween } from "@/features/tasso/lib/position";
import {
	createProjectSchema,
	deleteProjectSchema,
	updateProjectSchema,
} from "@/features/tasso/lib/tasso-schemas";
import { and, asc, db, eq, isNull, tassoColumns, tassoProjects } from "@ethos/db";
import { revalidatePath } from "next/cache";

async function getAuthedWorkspace() {
	const session = await auth();
	if (!session?.user?.id) throw new Error("Unauthorized");
	const workspace = await getWorkspace(session.user.id);
	if (!workspace) throw new Error("Workspace not found");
	return { session, workspace };
}

export async function getProjects() {
	const { workspace } = await getAuthedWorkspace();

	return db
		.select()
		.from(tassoProjects)
		.where(and(eq(tassoProjects.workspaceId, workspace.id), isNull(tassoProjects.archivedAt)))
		.orderBy(asc(tassoProjects.position));
}

export async function createProject(
	input: unknown,
): Promise<{ error: string } | { success: true; data: { id: string } }> {
	const { workspace } = await getAuthedWorkspace();

	const parsed = createProjectSchema.safeParse(input);
	if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

	const { name, description, color } = parsed.data;

	const existing = await db
		.select({ position: tassoProjects.position })
		.from(tassoProjects)
		.where(and(eq(tassoProjects.workspaceId, workspace.id), isNull(tassoProjects.archivedAt)))
		.orderBy(asc(tassoProjects.position));

	const lastPos = existing.at(-1)?.position ?? null;
	const position = generateKeyBetween(lastPos, null);

	const [project] = await db
		.insert(tassoProjects)
		.values({ workspaceId: workspace.id, name, description, color, position })
		.returning({ id: tassoProjects.id });

	if (!project) return { error: "Failed to create project" };

	const colPositions = [
		generateKeyBetween(null, null),
		generateKeyBetween(generateKeyBetween(null, null), null),
		generateKeyBetween(generateKeyBetween(generateKeyBetween(null, null), null), null),
	];

	await db.insert(tassoColumns).values(
		DEFAULT_COLUMNS.map((colName, i) => ({
			projectId: project.id,
			name: colName,
			position: colPositions[i] as string,
		})),
	);

	revalidatePath("/tasso");
	return { success: true, data: { id: project.id } };
}

export async function updateProject(
	input: unknown,
): Promise<{ error: string } | { success: true }> {
	const { workspace } = await getAuthedWorkspace();

	const parsed = updateProjectSchema.safeParse(input);
	if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

	const { projectId, ...updates } = parsed.data;

	const [project] = await db
		.select({ workspaceId: tassoProjects.workspaceId })
		.from(tassoProjects)
		.where(eq(tassoProjects.id, projectId))
		.limit(1);

	if (!project || project.workspaceId !== workspace.id) return { error: "Forbidden" };

	await db
		.update(tassoProjects)
		.set({ ...updates })
		.where(eq(tassoProjects.id, projectId));

	revalidatePath("/tasso");
	return { success: true };
}

export async function deleteProject(
	input: unknown,
): Promise<{ error: string } | { success: true }> {
	const { workspace } = await getAuthedWorkspace();

	const parsed = deleteProjectSchema.safeParse(input);
	if (!parsed.success) return { error: "Invalid input" };

	const { projectId } = parsed.data;

	const [project] = await db
		.select({ workspaceId: tassoProjects.workspaceId })
		.from(tassoProjects)
		.where(eq(tassoProjects.id, projectId))
		.limit(1);

	if (!project || project.workspaceId !== workspace.id) return { error: "Forbidden" };

	await db.delete(tassoProjects).where(eq(tassoProjects.id, projectId));

	revalidatePath("/tasso");
	return { success: true };
}

export async function reorderProject(
	projectId: string,
	newPosition: string,
): Promise<{ error: string } | { success: true }> {
	const { workspace } = await getAuthedWorkspace();

	const [project] = await db
		.select({ workspaceId: tassoProjects.workspaceId })
		.from(tassoProjects)
		.where(eq(tassoProjects.id, projectId))
		.limit(1);

	if (!project || project.workspaceId !== workspace.id) return { error: "Forbidden" };

	await db
		.update(tassoProjects)
		.set({ position: newPosition })
		.where(eq(tassoProjects.id, projectId));

	revalidatePath("/tasso");
	return { success: true };
}
