"use server";

import { auth } from "@/auth";
import { getWorkspace } from "@/features/kuroji/actions/workspace";
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
	eq,
	isNotNull,
	isNull,
	seiryuCards,
	seiryuChecklistItems,
	seiryuColumns,
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

export async function getCard(cardId: string) {
	const { workspace } = await getAuthedWorkspace();

	const [owned] = await db
		.select({ id: seiryuCards.id })
		.from(seiryuCards)
		.innerJoin(seiryuProjects, eq(seiryuProjects.id, seiryuCards.projectId))
		.where(and(eq(seiryuCards.id, cardId), eq(seiryuProjects.workspaceId, workspace.id)))
		.limit(1);

	if (!owned) return null;

	const row = await db.query.seiryuCards.findFirst({
		where: eq(seiryuCards.id, cardId),
		with: {
			checklistItems: { orderBy: asc(seiryuChecklistItems.position) },
			cardLabels: { with: { label: true } },
		},
	});

	if (!row) return null;

	const { cardLabels, checklistItems, ...rest } = row;
	return {
		...rest,
		checklistItems: checklistItems.map(({ id, title, isCompleted, position }) => ({
			id,
			title,
			isCompleted,
			position,
		})),
		labels: cardLabels.map(({ label }) => ({
			id: label.id,
			name: label.name,
			color: label.color,
		})),
	};
}

export async function getCards(projectId: string) {
	const { workspace } = await getAuthedWorkspace();

	const [project] = await db
		.select({ id: seiryuProjects.id })
		.from(seiryuProjects)
		.where(and(eq(seiryuProjects.id, projectId), eq(seiryuProjects.workspaceId, workspace.id)))
		.limit(1);

	if (!project) throw new Error("Forbidden");

	const rows = await db.query.seiryuCards.findMany({
		where: and(eq(seiryuCards.projectId, projectId), isNull(seiryuCards.archivedAt)),
		orderBy: asc(seiryuCards.position),
		with: {
			checklistItems: { orderBy: asc(seiryuChecklistItems.position) },
			cardLabels: { with: { label: true } },
		},
	});

	return rows.map(({ cardLabels, checklistItems, ...rest }) => ({
		...rest,
		checklistItems: checklistItems.map(({ id, title, isCompleted, position }) => ({
			id,
			title,
			isCompleted,
			position,
		})),
		labels: cardLabels.map(({ label }) => ({
			id: label.id,
			name: label.name,
			color: label.color,
		})),
	}));
}

export async function createCard(
	input: unknown,
): Promise<{ error: string } | { success: true; data: { id: string; position: string } }> {
	const { workspace } = await getAuthedWorkspace();

	const parsed = createCardSchema.safeParse(input);
	if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

	const { columnId, projectId, title } = parsed.data;

	const [project] = await db
		.select({ id: seiryuProjects.id })
		.from(seiryuProjects)
		.where(and(eq(seiryuProjects.id, projectId), eq(seiryuProjects.workspaceId, workspace.id)))
		.limit(1);
	if (!project) return { error: "Forbidden" };

	const [col] = await db
		.select({ id: seiryuColumns.id })
		.from(seiryuColumns)
		.where(and(eq(seiryuColumns.id, columnId), eq(seiryuColumns.projectId, projectId)))
		.limit(1);
	if (!col) return { error: "Invalid column" };

	const existing = await db
		.select({ position: seiryuCards.position })
		.from(seiryuCards)
		.where(and(eq(seiryuCards.columnId, columnId), isNull(seiryuCards.archivedAt)))
		.orderBy(asc(seiryuCards.position));

	const lastPos = existing.at(-1)?.position ?? null;
	const position = generateKeyBetween(lastPos, null);

	const [card] = await db
		.insert(seiryuCards)
		.values({ columnId, projectId, title, position })
		.returning({ id: seiryuCards.id, position: seiryuCards.position });

	if (!card) return { error: "Failed to create card" };

	revalidatePath(`/seiryu/${projectId}`);
	return { success: true, data: { id: card.id, position: card.position } };
}

export async function updateCard(input: unknown): Promise<{ error: string } | { success: true }> {
	const { workspace } = await getAuthedWorkspace();

	const parsed = updateCardSchema.safeParse(input);
	if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

	const { cardId, ...updates } = parsed.data;

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

	await db.update(seiryuCards).set(updates).where(eq(seiryuCards.id, cardId));

	revalidatePath(`/seiryu/${card.projectId}`);
	return { success: true };
}

export async function archiveCard(input: unknown): Promise<{ error: string } | { success: true }> {
	const { workspace } = await getAuthedWorkspace();

	const parsed = archiveCardSchema.safeParse(input);
	if (!parsed.success) return { error: "Invalid input" };

	const { cardId } = parsed.data;

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

	await db.update(seiryuCards).set({ archivedAt: new Date() }).where(eq(seiryuCards.id, cardId));

	revalidatePath(`/seiryu/${card.projectId}`);
	return { success: true };
}

export async function moveCard(input: unknown): Promise<{ error: string } | { success: true }> {
	const { workspace } = await getAuthedWorkspace();

	const parsed = moveCardSchema.safeParse(input);
	if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

	const { cardId, newColumnId, newPosition } = parsed.data;

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

	const [col] = await db
		.select({ id: seiryuColumns.id })
		.from(seiryuColumns)
		.where(and(eq(seiryuColumns.id, newColumnId), eq(seiryuColumns.projectId, card.projectId)))
		.limit(1);

	if (!col) return { error: "Invalid column" };

	await db
		.update(seiryuCards)
		.set({ columnId: newColumnId, position: newPosition })
		.where(eq(seiryuCards.id, cardId));

	revalidatePath(`/seiryu/${card.projectId}`);
	return { success: true };
}

export async function reorderCards(input: unknown): Promise<{ error: string } | { success: true }> {
	const { workspace } = await getAuthedWorkspace();

	const parsed = reorderCardSchema.safeParse(input);
	if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

	const { cardId, newPosition } = parsed.data;

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

	await db.update(seiryuCards).set({ position: newPosition }).where(eq(seiryuCards.id, cardId));

	revalidatePath(`/seiryu/${card.projectId}`);
	return { success: true };
}

export async function getArchivedCards(projectId: string) {
	const { workspace } = await getAuthedWorkspace();

	const [project] = await db
		.select({ id: seiryuProjects.id })
		.from(seiryuProjects)
		.where(and(eq(seiryuProjects.id, projectId), eq(seiryuProjects.workspaceId, workspace.id)))
		.limit(1);

	if (!project) throw new Error("Forbidden");

	const rows = await db.query.seiryuCards.findMany({
		where: and(eq(seiryuCards.projectId, projectId), isNotNull(seiryuCards.archivedAt)),
		orderBy: asc(seiryuCards.archivedAt),
		with: {
			checklistItems: { orderBy: asc(seiryuChecklistItems.position) },
			cardLabels: { with: { label: true } },
		},
	});

	return rows.map(({ cardLabels, checklistItems, ...rest }) => ({
		...rest,
		checklistItems: checklistItems.map(({ id, title, isCompleted, position }) => ({
			id,
			title,
			isCompleted,
			position,
		})),
		labels: cardLabels.map(({ label }) => ({ id: label.id, name: label.name, color: label.color })),
	}));
}

export async function restoreCard(
	input: unknown,
): Promise<{ error: string } | { success: true; data: { columnId: string; position: string } }> {
	const { workspace } = await getAuthedWorkspace();

	const parsed = restoreCardSchema.safeParse(input);
	if (!parsed.success) return { error: "Invalid input" };

	const { cardId } = parsed.data;

	const [card] = await db
		.select({ projectId: seiryuCards.projectId, columnId: seiryuCards.columnId })
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

	const lastInCol = await db
		.select({ position: seiryuCards.position })
		.from(seiryuCards)
		.where(and(eq(seiryuCards.columnId, card.columnId), isNull(seiryuCards.archivedAt)))
		.orderBy(asc(seiryuCards.position));

	const newPosition = generateKeyBetween(lastInCol.at(-1)?.position ?? null, null);

	const [updated] = await db
		.update(seiryuCards)
		.set({ archivedAt: null, position: newPosition })
		.where(eq(seiryuCards.id, cardId))
		.returning({ id: seiryuCards.id });

	if (!updated) return { error: "Failed to restore card" };

	revalidatePath(`/seiryu/${card.projectId}`);
	return { success: true, data: { columnId: card.columnId, position: newPosition } };
}

export async function deleteCard(input: unknown): Promise<{ error: string } | { success: true }> {
	const { workspace } = await getAuthedWorkspace();

	const parsed = deleteCardSchema.safeParse(input);
	if (!parsed.success) return { error: "Invalid input" };

	const { cardId } = parsed.data;

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

	await db.delete(seiryuCards).where(eq(seiryuCards.id, cardId));

	revalidatePath(`/seiryu/${card.projectId}`);
	return { success: true };
}
