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
	seiryuCardLabels,
	seiryuCards,
	seiryuLabels,
	seiryuProjects,
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
		.select({ id: seiryuProjects.id })
		.from(seiryuProjects)
		.where(and(eq(seiryuProjects.id, projectId), eq(seiryuProjects.workspaceId, workspace.id)))
		.limit(1);
	if (!project) throw new Error("Forbidden");

	return db.select().from(seiryuLabels).where(eq(seiryuLabels.projectId, projectId));
}

export async function createLabel(
	input: unknown,
): Promise<{ error: string } | { success: true; data: { id: string } }> {
	const { workspace } = await getAuthedWorkspace();

	const parsed = createLabelSchema.safeParse(input);
	if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

	const { projectId, name, color } = parsed.data;

	const [project] = await db
		.select({ id: seiryuProjects.id })
		.from(seiryuProjects)
		.where(and(eq(seiryuProjects.id, projectId), eq(seiryuProjects.workspaceId, workspace.id)))
		.limit(1);
	if (!project) return { error: "Forbidden" };

	const [label] = await db
		.insert(seiryuLabels)
		.values({ projectId, name, color })
		.returning({ id: seiryuLabels.id })
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
		.select({ projectId: seiryuLabels.projectId })
		.from(seiryuLabels)
		.where(eq(seiryuLabels.id, labelId))
		.limit(1);
	if (!label) return { error: "Not found" };

	const [project] = await db
		.select({ id: seiryuProjects.id })
		.from(seiryuProjects)
		.where(and(eq(seiryuProjects.id, label.projectId), eq(seiryuProjects.workspaceId, workspace.id)))
		.limit(1);
	if (!project) return { error: "Forbidden" };

	await db.delete(seiryuLabels).where(eq(seiryuLabels.id, labelId));

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
		.select({ projectId: seiryuCards.projectId })
		.from(seiryuCards)
		.where(eq(seiryuCards.id, cardId))
		.limit(1);
	if (!card) return { error: "Card not found" };

	const [project] = await db
		.select({ id: seiryuProjects.id })
		.from(seiryuProjects)
		.where(and(eq(seiryuProjects.id, card.projectId), eq(seiryuProjects.workspaceId, workspace.id)))
		.limit(1);
	if (!project) return { error: "Forbidden" };

	if (labelIds.length > 0) {
		const valid = await db
			.select({ id: seiryuLabels.id })
			.from(seiryuLabels)
			.where(and(inArray(seiryuLabels.id, labelIds), eq(seiryuLabels.projectId, card.projectId)));
		if (valid.length !== labelIds.length) return { error: "Invalid label" };
	}

	await db.transaction(async (tx) => {
		await tx.delete(seiryuCardLabels).where(eq(seiryuCardLabels.cardId, cardId));
		if (labelIds.length > 0) {
			await tx.insert(seiryuCardLabels).values(labelIds.map((labelId) => ({ cardId, labelId })));
		}
	});

	revalidatePath(`/seiryu/${card.projectId}`);
	return { success: true };
}
