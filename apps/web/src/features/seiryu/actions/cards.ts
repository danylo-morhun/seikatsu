"use server";

import {
	and,
	asc,
	count,
	db,
	desc,
	eq,
	isNotNull,
	isNull,
	seiryuCards,
	seiryuChecklistItems,
	seiryuColumns,
	seiryuProjects,
} from "@seikatsu/db";
import { revalidatePath } from "next/cache";
import { getColumns } from "@/features/seiryu/actions/columns";
import {
	getOwnedCard,
	getOwnedColumn,
	isOwnedProject,
	isUuid,
	requireWorkspace,
} from "@/features/seiryu/actions/guard";
import { getLabels } from "@/features/seiryu/actions/labels";
import { nextDue, reminderAt, shortTime } from "@/features/seiryu/lib/reminder";
import {
	archiveCardSchema,
	createCardSchema,
	deleteCardSchema,
	moveCardSchema,
	reorderCardSchema,
	restoreCardSchema,
	snoozeCardSchema,
	updateCardSchema,
} from "@/features/seiryu/lib/seiryu-schemas";
import { generateKeyBetween } from "@/lib/position";
import { revalidateShell } from "@/lib/revalidate";
import { getUserTimeZone, getUserToday } from "@/lib/timezone";

type CardRow = Omit<typeof seiryuCards.$inferSelect, "description" | "remindAt"> & {
	description?: string | null;
	hasDescription?: boolean;
	checklistItems: (typeof seiryuChecklistItems.$inferSelect)[];
	cardLabels: { label: { id: string; name: string; color: string } }[];
};

const cardWith = {
	checklistItems: { orderBy: asc(seiryuChecklistItems.position) },
	cardLabels: { with: { label: true } },
} as const;

function toCardData({ cardLabels, checklistItems, hasDescription, ...rest }: CardRow) {
	return {
		...rest,
		dueTime: shortTime(rest.dueTime),
		hasDescription: hasDescription ?? rest.description != null,
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

/** The newest archived cards the board's archive sheet lists; the rest are in settings. */
const BOARD_ARCHIVED_LIMIT = 50;

/**
 * Everything one project's board shows, or null if the project isn't the user's: one
 * ownership check (getColumns and getLabels reuse its cached answer), then all at once.
 * Card descriptions stay here until a card is opened (getCardDescription).
 */
export async function getBoard(projectId: string) {
	const workspace = await requireWorkspace();
	if (!isUuid(projectId) || !(await isOwnedProject(projectId, workspace.id))) return null;

	const [columns, rows, labels, archived, [archivedTotal]] = await Promise.all([
		getColumns(projectId),
		db.query.seiryuCards.findMany({
			columns: { description: false, remindAt: false },
			extras: (card, { sql }) => ({
				hasDescription: sql<boolean>`${card.description} is not null`.as("has_description"),
			}),
			where: and(eq(seiryuCards.projectId, projectId), isNull(seiryuCards.archivedAt)),
			orderBy: asc(seiryuCards.position),
			with: cardWith,
		}),
		getLabels(projectId),
		getWorkspaceArchivedCards(projectId, BOARD_ARCHIVED_LIMIT),
		db
			.select({ total: count() })
			.from(seiryuCards)
			.where(and(eq(seiryuCards.projectId, projectId), isNotNull(seiryuCards.archivedAt))),
	]);
	return {
		columns,
		cards: rows.map(toCardData),
		labels,
		archived,
		archivedTotal: archivedTotal?.total ?? 0,
	};
}

/** One card's description, which the board leaves out until the card is opened. */
export async function getCardDescription(
	cardId: string,
): Promise<{ error: string } | { success: true; data: string | null }> {
	const workspace = await requireWorkspace();
	if (!isUuid(cardId)) return { error: "Card not found" };

	const [card] = await db
		.select({ description: seiryuCards.description })
		.from(seiryuCards)
		.innerJoin(seiryuProjects, eq(seiryuProjects.id, seiryuCards.projectId))
		.where(and(eq(seiryuCards.id, cardId), eq(seiryuProjects.workspaceId, workspace.id)))
		.limit(1);
	if (!card) return { error: "Card not found" };
	return { success: true, data: card.description };
}

/** Archived cards across the workspace, or in one of its projects, with where they lived. */
export async function getWorkspaceArchivedCards(projectId?: string, limit?: number) {
	const workspace = await requireWorkspace();
	const query = db
		.select({
			id: seiryuCards.id,
			title: seiryuCards.title,
			archivedAt: seiryuCards.archivedAt,
			projectId: seiryuProjects.id,
			projectName: seiryuProjects.name,
			columnName: seiryuColumns.name,
		})
		.from(seiryuCards)
		.innerJoin(seiryuProjects, eq(seiryuProjects.id, seiryuCards.projectId))
		.innerJoin(seiryuColumns, eq(seiryuColumns.id, seiryuCards.columnId))
		.where(
			and(
				eq(seiryuProjects.workspaceId, workspace.id),
				isNotNull(seiryuCards.archivedAt),
				projectId ? eq(seiryuCards.projectId, projectId) : undefined,
			),
		)
		.orderBy(asc(seiryuProjects.position), desc(seiryuCards.archivedAt));
	return limit ? query.limit(limit) : query;
}

export async function createCard(
	input: unknown,
): Promise<{ error: string } | { success: true; data: { id: string; position: string } }> {
	const workspace = await requireWorkspace();

	const parsed = createCardSchema.safeParse(input);
	if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

	const { id, columnId, projectId, title } = parsed.data;

	const column = await getOwnedColumn(columnId, workspace.id);
	if (column?.projectId !== projectId) return { error: "Invalid column" };

	if (id) {
		// Sent again (offline replay, lost response): the first one stands.
		const existing = await getOwnedCard(id, workspace.id);
		if (existing) return { success: true, data: { id, position: existing.position } };
	}

	const [card] = await db
		.insert(seiryuCards)
		.values({ id, columnId, projectId, title, position: await endOfColumn(columnId) })
		.returning({ id: seiryuCards.id, position: seiryuCards.position });

	if (!card) return { error: "Failed to create card" };

	// Open-card counts in the project list change too.
	revalidatePath("/seiryu", "layout");
	revalidateShell();
	return { success: true, data: { id: card.id, position: card.position } };
}

export async function updateCard(input: unknown): Promise<{ error: string } | { success: true }> {
	const workspace = await requireWorkspace();

	const parsed = updateCardSchema.safeParse(input);
	if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

	const { cardId, ...updates } = parsed.data;

	const card = await getOwnedCard(cardId, workspace.id);
	if (!card) return { error: "Card not found" };

	const { dueDate, dueTime, remindMinutes, ...rest } = updates;
	const dueEdit = Object.fromEntries(
		Object.entries({ dueDate, dueTime, remindMinutes }).filter(([, v]) => v !== undefined),
	);
	let due = {};
	if (Object.keys(dueEdit).length > 0) {
		const next = nextDue(
			{
				dueDate: card.dueDate,
				dueTime: shortTime(card.dueTime),
				remindMinutes: card.remindMinutes,
			},
			dueEdit,
		);
		due = { ...next, remindAt: reminderAt(next, await getUserTimeZone()) };
	}

	await db
		.update(seiryuCards)
		.set({ ...rest, ...due })
		.where(eq(seiryuCards.id, cardId));

	revalidatePath(`/seiryu/${card.projectId}`);
	revalidateShell();
	return { success: true };
}

/** "Remind me later": the reminder goes off again in `minutes`, the due date stays. */
export async function snoozeCard(input: unknown): Promise<{ error: string } | { success: true }> {
	const workspace = await requireWorkspace();

	const parsed = snoozeCardSchema.safeParse(input);
	if (!parsed.success) return { error: "Invalid input" };

	const card = await getOwnedCard(parsed.data.cardId, workspace.id);
	if (!card) return { error: "Card not found" };

	await db
		.update(seiryuCards)
		.set({ remindAt: new Date(Date.now() + parsed.data.minutes * 60_000) })
		.where(eq(seiryuCards.id, card.id));
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

	// Open-card counts in the project list change too.
	revalidatePath("/seiryu", "layout");
	revalidateShell();
	revalidatePath("/settings/seiryu");
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
	// Done on the day it first reaches a finish column; reopened, it's open again.
	const doneOn = column.isDone ? (card.doneOn ?? (await getUserToday())) : null;
	await db
		.update(seiryuCards)
		.set({ columnId: newColumnId, position, doneOn })
		.where(eq(seiryuCards.id, cardId));

	// Open-card counts in the project list change too.
	revalidatePath("/seiryu", "layout");
	revalidateShell();
	return { success: true, data: { position } };
}

/** Done from outside the board (a reminder's button): to the project's first finish column. */
export async function finishOnServer(input: unknown) {
	const workspace = await requireWorkspace();
	const parsed = snoozeCardSchema.pick({ cardId: true }).safeParse(input);
	if (!parsed.success) return { error: "Invalid input" };

	const card = await getOwnedCard(parsed.data.cardId, workspace.id);
	if (!card) return { error: "Card not found" };
	const [done] = await db
		.select({ id: seiryuColumns.id })
		.from(seiryuColumns)
		.where(and(eq(seiryuColumns.projectId, card.projectId), eq(seiryuColumns.isDone, true)))
		.orderBy(asc(seiryuColumns.position))
		.limit(1);
	if (!done) return { error: "This project has no finish column" };
	if (card.columnId === done.id) return { success: true as const };
	return moveCard({ cardId: card.id, newColumnId: done.id });
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
	revalidateShell();
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

	// Open-card counts in the project list change too.
	revalidatePath("/seiryu", "layout");
	revalidateShell();
	revalidatePath("/settings/seiryu");
	return { success: true, data: { columnId: card.columnId, position } };
}

export async function deleteCard(input: unknown): Promise<{ error: string } | { success: true }> {
	const workspace = await requireWorkspace();

	const parsed = deleteCardSchema.safeParse(input);
	if (!parsed.success) return { error: "Invalid input" };

	const card = await getOwnedCard(parsed.data.cardId, workspace.id);
	if (!card) return { error: "Card not found" };

	await db.delete(seiryuCards).where(eq(seiryuCards.id, parsed.data.cardId));

	// Open-card counts in the project list change too.
	revalidatePath("/seiryu", "layout");
	revalidateShell();
	revalidatePath("/settings/seiryu");
	return { success: true };
}
