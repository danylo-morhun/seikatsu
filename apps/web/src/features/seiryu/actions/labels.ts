"use server";

import {
	getOwnedCard,
	getOwnedLabel,
	isOwnedProject,
	requireWorkspace,
} from "@/features/seiryu/actions/guard";
import {
	createLabelSchema,
	deleteLabelSchema,
	setCardLabelsSchema,
	updateLabelSchema,
} from "@/features/seiryu/lib/seiryu-schemas";
import { and, asc, db, eq, inArray, seiryuCardLabels, seiryuLabels } from "@seikatsu/db";
import { revalidatePath } from "next/cache";

export async function getLabels(projectId: string) {
	const workspace = await requireWorkspace();
	if (!(await isOwnedProject(projectId, workspace.id))) throw new Error("Forbidden");

	return db
		.select()
		.from(seiryuLabels)
		.where(eq(seiryuLabels.projectId, projectId))
		.orderBy(asc(seiryuLabels.name));
}

export async function createLabel(
	input: unknown,
): Promise<{ error: string } | { success: true; data: { id: string } }> {
	const workspace = await requireWorkspace();

	const parsed = createLabelSchema.safeParse(input);
	if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

	const { projectId, name, color } = parsed.data;

	if (!(await isOwnedProject(projectId, workspace.id))) return { error: "Project not found" };

	const [label] = await db
		.insert(seiryuLabels)
		.values({ projectId, name, color })
		.onConflictDoNothing()
		.returning({ id: seiryuLabels.id });
	if (!label) return { error: "Label already exists" };

	revalidatePath(`/seiryu/${projectId}`);
	return { success: true, data: { id: label.id } };
}

export async function updateLabel(input: unknown): Promise<{ error: string } | { success: true }> {
	const workspace = await requireWorkspace();

	const parsed = updateLabelSchema.safeParse(input);
	if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

	const { labelId, ...updates } = parsed.data;

	const label = await getOwnedLabel(labelId, workspace.id);
	if (!label) return { error: "Label not found" };

	if (updates.name) {
		const [clash] = await db
			.select({ id: seiryuLabels.id })
			.from(seiryuLabels)
			.where(and(eq(seiryuLabels.projectId, label.projectId), eq(seiryuLabels.name, updates.name)))
			.limit(1);
		if (clash && clash.id !== labelId) return { error: "Label already exists" };
	}

	await db.update(seiryuLabels).set(updates).where(eq(seiryuLabels.id, labelId));

	revalidatePath(`/seiryu/${label.projectId}`);
	return { success: true };
}

export async function deleteLabel(input: unknown): Promise<{ error: string } | { success: true }> {
	const workspace = await requireWorkspace();

	const parsed = deleteLabelSchema.safeParse(input);
	if (!parsed.success) return { error: "Invalid input" };

	const label = await getOwnedLabel(parsed.data.labelId, workspace.id);
	if (!label) return { error: "Label not found" };

	await db.delete(seiryuLabels).where(eq(seiryuLabels.id, parsed.data.labelId));

	revalidatePath(`/seiryu/${label.projectId}`);
	return { success: true };
}

export async function setCardLabels(
	input: unknown,
): Promise<{ error: string } | { success: true }> {
	const workspace = await requireWorkspace();

	const parsed = setCardLabelsSchema.safeParse(input);
	if (!parsed.success) return { error: "Invalid input" };

	const { cardId, labelIds } = parsed.data;

	const card = await getOwnedCard(cardId, workspace.id);
	if (!card) return { error: "Card not found" };

	// assertLabelsInProject: every label must belong to the card's project.
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
