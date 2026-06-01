"use server";

import { auth } from "@/auth";
import { getWorkspace } from "@/features/kuroji/actions/workspace";
import {
	createLabelSchema,
	deleteLabelSchema,
	setCardLabelsSchema,
} from "@/features/seiryu/lib/seiryu-schemas";
import {
	and,
	db,
	eq,
	inArray,
	tassoCardLabels,
	tassoCards,
	tassoLabels,
	tassoProjects,
} from "@seikatsu/db";
import { revalidatePath } from "next/cache";

async function getAuthedWorkspace() {
	const session = await auth();
	if (!session?.user?.id) throw new Error("Unauthorized");
	const workspace = await getWorkspace(session.user.id);
	if (!workspace) throw new Error("Workspace not found");
	return { workspace };
}

export async function getLabels(projectId: string) {
	const { workspace } = await getAuthedWorkspace();

	const [project] = await db
		.select({ id: tassoProjects.id })
		.from(tassoProjects)
		.where(and(eq(tassoProjects.id, projectId), eq(tassoProjects.workspaceId, workspace.id)))
		.limit(1);
	if (!project) throw new Error("Forbidden");

	return db.select().from(tassoLabels).where(eq(tassoLabels.projectId, projectId));
}

export async function createLabel(
	input: unknown,
): Promise<{ error: string } | { success: true; data: { id: string } }> {
	const { workspace } = await getAuthedWorkspace();

	const parsed = createLabelSchema.safeParse(input);
	if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

	const { projectId, name, color } = parsed.data;

	const [project] = await db
		.select({ id: tassoProjects.id })
		.from(tassoProjects)
		.where(and(eq(tassoProjects.id, projectId), eq(tassoProjects.workspaceId, workspace.id)))
		.limit(1);
	if (!project) return { error: "Forbidden" };

	const [label] = await db
		.insert(tassoLabels)
		.values({ projectId, name, color })
		.returning({ id: tassoLabels.id })
		.onConflictDoNothing();
	if (!label) return { error: "Label already exists" };

	revalidatePath(`/seiryu/${projectId}`);
	return { success: true, data: { id: label.id } };
}

export async function deleteLabel(input: unknown): Promise<{ error: string } | { success: true }> {
	const { workspace } = await getAuthedWorkspace();

	const parsed = deleteLabelSchema.safeParse(input);
	if (!parsed.success) return { error: "Invalid input" };

	const { labelId } = parsed.data;

	const [label] = await db
		.select({ projectId: tassoLabels.projectId })
		.from(tassoLabels)
		.where(eq(tassoLabels.id, labelId))
		.limit(1);
	if (!label) return { error: "Not found" };

	const [project] = await db
		.select({ id: tassoProjects.id })
		.from(tassoProjects)
		.where(and(eq(tassoProjects.id, label.projectId), eq(tassoProjects.workspaceId, workspace.id)))
		.limit(1);
	if (!project) return { error: "Forbidden" };

	await db.delete(tassoLabels).where(eq(tassoLabels.id, labelId));

	revalidatePath(`/seiryu/${label.projectId}`);
	return { success: true };
}

export async function setCardLabels(
	input: unknown,
): Promise<{ error: string } | { success: true }> {
	const { workspace } = await getAuthedWorkspace();

	const parsed = setCardLabelsSchema.safeParse(input);
	if (!parsed.success) return { error: "Invalid input" };

	const { cardId, labelIds } = parsed.data;

	const [card] = await db
		.select({ projectId: tassoCards.projectId })
		.from(tassoCards)
		.where(eq(tassoCards.id, cardId))
		.limit(1);
	if (!card) return { error: "Card not found" };

	const [project] = await db
		.select({ id: tassoProjects.id })
		.from(tassoProjects)
		.where(and(eq(tassoProjects.id, card.projectId), eq(tassoProjects.workspaceId, workspace.id)))
		.limit(1);
	if (!project) return { error: "Forbidden" };

	if (labelIds.length > 0) {
		const valid = await db
			.select({ id: tassoLabels.id })
			.from(tassoLabels)
			.where(and(inArray(tassoLabels.id, labelIds), eq(tassoLabels.projectId, card.projectId)));
		if (valid.length !== labelIds.length) return { error: "Invalid label" };
	}

	await db.transaction(async (tx) => {
		await tx.delete(tassoCardLabels).where(eq(tassoCardLabels.cardId, cardId));
		if (labelIds.length > 0) {
			await tx.insert(tassoCardLabels).values(labelIds.map((labelId) => ({ cardId, labelId })));
		}
	});

	revalidatePath(`/seiryu/${card.projectId}`);
	return { success: true };
}
