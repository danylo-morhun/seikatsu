"use server";

import { auth } from "@/auth";
import { getWorkspace } from "@/features/midas/actions/workspace";
import { generateKeyBetween } from "@/features/tasso/lib/position";
import {
	archiveCardSchema,
	createCardSchema,
	moveCardSchema,
	reorderCardSchema,
	updateCardSchema,
} from "@/features/tasso/lib/tasso-schemas";
import {
	and,
	asc,
	db,
	eq,
	isNull,
	tassoCards,
	tassoChecklistItems,
	tassoColumns,
	tassoProjects,
} from "@ethos/db";
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

	const row = await db.query.tassoCards.findFirst({
		where: eq(tassoCards.id, cardId),
		with: {
			checklistItems: { orderBy: asc(tassoChecklistItems.position) },
			cardLabels: { with: { label: true } },
		},
	});

	if (!row) return null;

	const [project] = await db
		.select({ id: tassoProjects.id })
		.from(tassoProjects)
		.where(and(eq(tassoProjects.id, row.projectId), eq(tassoProjects.workspaceId, workspace.id)))
		.limit(1);

	if (!project) return null;

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
		.select({ id: tassoProjects.id })
		.from(tassoProjects)
		.where(and(eq(tassoProjects.id, projectId), eq(tassoProjects.workspaceId, workspace.id)))
		.limit(1);

	if (!project) throw new Error("Forbidden");

	const rows = await db.query.tassoCards.findMany({
		where: and(eq(tassoCards.projectId, projectId), isNull(tassoCards.archivedAt)),
		orderBy: asc(tassoCards.position),
		with: {
			checklistItems: { orderBy: asc(tassoChecklistItems.position) },
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
): Promise<{ error: string } | { success: true; data: { id: string } }> {
	const { workspace } = await getAuthedWorkspace();

	const parsed = createCardSchema.safeParse(input);
	if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

	const { columnId, projectId, title } = parsed.data;

	const [project] = await db
		.select({ id: tassoProjects.id })
		.from(tassoProjects)
		.where(and(eq(tassoProjects.id, projectId), eq(tassoProjects.workspaceId, workspace.id)))
		.limit(1);
	if (!project) return { error: "Forbidden" };

	const [col] = await db
		.select({ id: tassoColumns.id })
		.from(tassoColumns)
		.where(and(eq(tassoColumns.id, columnId), eq(tassoColumns.projectId, projectId)))
		.limit(1);
	if (!col) return { error: "Invalid column" };

	const existing = await db
		.select({ position: tassoCards.position })
		.from(tassoCards)
		.where(and(eq(tassoCards.columnId, columnId), isNull(tassoCards.archivedAt)))
		.orderBy(asc(tassoCards.position));

	const lastPos = existing.at(-1)?.position ?? null;
	const position = generateKeyBetween(lastPos, null);

	const [card] = await db
		.insert(tassoCards)
		.values({ columnId, projectId, title, position })
		.returning({ id: tassoCards.id });

	if (!card) return { error: "Failed to create card" };

	revalidatePath(`/tasso/${projectId}`);
	return { success: true, data: { id: card.id } };
}

export async function updateCard(input: unknown): Promise<{ error: string } | { success: true }> {
	const { workspace } = await getAuthedWorkspace();

	const parsed = updateCardSchema.safeParse(input);
	if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

	const { cardId, ...updates } = parsed.data;

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

	await db.update(tassoCards).set(updates).where(eq(tassoCards.id, cardId));

	revalidatePath(`/tasso/${card.projectId}`);
	return { success: true };
}

export async function archiveCard(input: unknown): Promise<{ error: string } | { success: true }> {
	const { workspace } = await getAuthedWorkspace();

	const parsed = archiveCardSchema.safeParse(input);
	if (!parsed.success) return { error: "Invalid input" };

	const { cardId } = parsed.data;

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

	await db.update(tassoCards).set({ archivedAt: new Date() }).where(eq(tassoCards.id, cardId));

	revalidatePath(`/tasso/${card.projectId}`);
	return { success: true };
}

export async function moveCard(input: unknown): Promise<{ error: string } | { success: true }> {
	const { workspace } = await getAuthedWorkspace();

	const parsed = moveCardSchema.safeParse(input);
	if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

	const { cardId, newColumnId, newPosition } = parsed.data;

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

	const [col] = await db
		.select({ id: tassoColumns.id })
		.from(tassoColumns)
		.where(and(eq(tassoColumns.id, newColumnId), eq(tassoColumns.projectId, card.projectId)))
		.limit(1);

	if (!col) return { error: "Invalid column" };

	await db
		.update(tassoCards)
		.set({ columnId: newColumnId, position: newPosition })
		.where(eq(tassoCards.id, cardId));

	revalidatePath(`/tasso/${card.projectId}`);
	return { success: true };
}

export async function reorderCards(input: unknown): Promise<{ error: string } | { success: true }> {
	const { workspace } = await getAuthedWorkspace();

	const parsed = reorderCardSchema.safeParse(input);
	if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

	const { cardId, newPosition } = parsed.data;

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

	await db.update(tassoCards).set({ position: newPosition }).where(eq(tassoCards.id, cardId));

	revalidatePath(`/tasso/${card.projectId}`);
	return { success: true };
}
