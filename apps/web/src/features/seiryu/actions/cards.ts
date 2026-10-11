"use server";

import {
	getOwnedCard,
	getOwnedColumn,
	isOwnedProject,
	isUuid,
	requireWorkspace,
} from "@/features/seiryu/actions/guard";
import { generateKeyBetween } from "@/features/seiryu/lib/position";
import {
	archiveCardSchema,
	createCardSchema,
	deleteCardSchema,
	moveCardSchema,
	reorderCardSchema,
	restoreCardSchema,
	updateCardSchema,
} from "@/features/seiryu/lib/seiryu-schemas";
import {
	and,
	asc,
	db,
	desc,
	eq,
	isNotNull,
	isNull,
	seiryuCards,
	seiryuChecklistItems,
} from "@seikatsu/db";
import { revalidatePath } from "next/cache";

type CardRow = typeof seiryuCards.$inferSelect & {
	checklistItems: (typeof seiryuChecklistItems.$inferSelect)[];
	cardLabels: { label: { id: string; name: string; color: string } }[];
};

const cardWith = {
	checklistItems: { orderBy: asc(seiryuChecklistItems.position) },
	cardLabels: { with: { label: true } },
} as const;

function toCardData({ cardLabels, checklistItems, ...rest }: CardRow) {
	return {
		...rest,
		checklistItems: checklistItems.map(({ id, title, isCompleted, position }) => ({
			id,
			title,
			isCompleted,
			position,
		})),
		labels: cardLabels.map(({ label }) => ({ id: label.id, name: label.name, color: label.color })),
	};
}

/** Position after the last live card in a column. */
async function endOfColumn(columnId: string) {
	const [last] = await db
		.select({ position: seiryuCards.position })
		.from(seiryuCards)
		.where(and(eq(seiryuCards.columnId, columnId), isNull(seiryuCards.archivedAt)))
		.orderBy(desc(seiryuCards.position))
		.limit(1);
	return generateKeyBetween(last?.position ?? null, null);
}

export async function getCard(cardId: string) {
	const workspace = await requireWorkspace();
	if (!isUuid(cardId) || !(await getOwnedCard(cardId, workspace.id))) return null;

	const row = await db.query.seiryuCards.findFirst({
		where: eq(seiryuCards.id, cardId),
		with: cardWith,
	});
	return row ? toCardData(row) : null;
}

export async function getCards(projectId: string) {
	const workspace = await requireWorkspace();
	if (!(await isOwnedProject(projectId, workspace.id))) throw new Error("Forbidden");

	const rows = await db.query.seiryuCards.findMany({
		where: and(eq(seiryuCards.projectId, projectId), isNull(seiryuCards.archivedAt)),
		orderBy: asc(seiryuCards.position),
		with: cardWith,
	});
	return rows.map(toCardData);
}

export async function getArchivedCards(projectId: string) {
	const workspace = await requireWorkspace();
	if (!(await isOwnedProject(projectId, workspace.id))) throw new Error("Forbidden");

	const rows = await db.query.seiryuCards.findMany({
		where: and(eq(seiryuCards.projectId, projectId), isNotNull(seiryuCards.archivedAt)),
		orderBy: desc(seiryuCards.archivedAt),
		with: cardWith,
	});
	return rows.map(toCardData);
}

export async function createCard(
	input: unknown,
): Promise<{ error: string } | { success: true; data: { id: string; position: string } }> {
	const workspace = await requireWorkspace();

	const parsed = createCardSchema.safeParse(input);
	if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

	const { columnId, projectId, title } = parsed.data;

	const column = await getOwnedColumn(columnId, workspace.id);
	if (column?.projectId !== projectId) return { error: "Invalid column" };

	const [card] = await db
		.insert(seiryuCards)
		.values({ columnId, projectId, title, position: await endOfColumn(columnId) })
		.returning({ id: seiryuCards.id, position: seiryuCards.position });

	if (!card) return { error: "Failed to create card" };

	revalidatePath(`/seiryu/${projectId}`);
	return { success: true, data: { id: card.id, position: card.position } };
}

export async function updateCard(input: unknown): Promise<{ error: string } | { success: true }> {
	const workspace = await requireWorkspace();

	const parsed = updateCardSchema.safeParse(input);
	if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

	const { cardId, ...updates } = parsed.data;

	const card = await getOwnedCard(cardId, workspace.id);
	if (!card) return { error: "Card not found" };

	await db.update(seiryuCards).set(updates).where(eq(seiryuCards.id, cardId));

	revalidatePath(`/seiryu/${card.projectId}`);
	return { success: true };
}

export async function archiveCard(input: unknown): Promise<{ error: string } | { success: true }> {
	const workspace = await requireWorkspace();

	const parsed = archiveCardSchema.safeParse(input);
	if (!parsed.success) return { error: "Invalid input" };

	const card = await getOwnedCard(parsed.data.cardId, workspace.id);
	if (!card) return { error: "Card not found" };

	await db
		.update(seiryuCards)
		.set({ archivedAt: new Date() })
		.where(eq(seiryuCards.id, parsed.data.cardId));

	revalidatePath(`/seiryu/${card.projectId}`);
	return { success: true };
}

export async function moveCard(
	input: unknown,
): Promise<{ error: string } | { success: true; data: { position: string } }> {
	const workspace = await requireWorkspace();

	const parsed = moveCardSchema.safeParse(input);
	if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

	const { cardId, newColumnId, newPosition } = parsed.data;

	const [card, column] = await Promise.all([
		getOwnedCard(cardId, workspace.id),
		getOwnedColumn(newColumnId, workspace.id),
	]);
	if (!card) return { error: "Card not found" };
	if (column?.projectId !== card.projectId) return { error: "Invalid column" };

	const position = newPosition ?? (await endOfColumn(newColumnId));
	await db
		.update(seiryuCards)
		.set({ columnId: newColumnId, position })
		.where(eq(seiryuCards.id, cardId));

	revalidatePath(`/seiryu/${card.projectId}`);
	return { success: true, data: { position } };
}

export async function reorderCards(input: unknown): Promise<{ error: string } | { success: true }> {
	const workspace = await requireWorkspace();

	const parsed = reorderCardSchema.safeParse(input);
	if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

	const { cardId, newPosition } = parsed.data;

	const card = await getOwnedCard(cardId, workspace.id);
	if (!card) return { error: "Card not found" };

	await db.update(seiryuCards).set({ position: newPosition }).where(eq(seiryuCards.id, cardId));

	revalidatePath(`/seiryu/${card.projectId}`);
	return { success: true };
}

export async function restoreCard(
	input: unknown,
): Promise<{ error: string } | { success: true; data: { columnId: string; position: string } }> {
	const workspace = await requireWorkspace();

	const parsed = restoreCardSchema.safeParse(input);
	if (!parsed.success) return { error: "Invalid input" };

	const { cardId } = parsed.data;

	const card = await getOwnedCard(cardId, workspace.id);
	if (!card) return { error: "Card not found" };

	const position = await endOfColumn(card.columnId);
	await db
		.update(seiryuCards)
		.set({ archivedAt: null, position })
		.where(eq(seiryuCards.id, cardId));

	revalidatePath(`/seiryu/${card.projectId}`);
	return { success: true, data: { columnId: card.columnId, position } };
}

export async function deleteCard(input: unknown): Promise<{ error: string } | { success: true }> {
	const workspace = await requireWorkspace();

	const parsed = deleteCardSchema.safeParse(input);
	if (!parsed.success) return { error: "Invalid input" };

	const card = await getOwnedCard(parsed.data.cardId, workspace.id);
	if (!card) return { error: "Card not found" };

	await db.delete(seiryuCards).where(eq(seiryuCards.id, parsed.data.cardId));

	revalidatePath(`/seiryu/${card.projectId}`);
	return { success: true };
}
