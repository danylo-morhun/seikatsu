"use server";

import {
	and,
	asc,
	db,
	desc,
	eq,
	isNull,
	seiryuCardLabels,
	seiryuCards,
	seiryuChecklistItems,
	seiryuColumns,
	seiryuGroups,
} from "@seikatsu/db";
import { revalidatePath } from "next/cache";
import { getOwnedGroup, isOwnedProject, requireWorkspace } from "@/features/seiryu/actions/guard";
import { addDays, daysBetween } from "@/features/seiryu/lib/filters";
import { reminderAt, shortTime } from "@/features/seiryu/lib/reminder";
import {
	copyGroupSchema,
	createGroupSchema,
	deleteGroupSchema,
	updateGroupSchema,
} from "@/features/seiryu/lib/seiryu-schemas";
import { generateKeyBetween, generateNKeysBetween } from "@/lib/position";
import { revalidateShell } from "@/lib/revalidate";
import { getUserTimeZone } from "@/lib/timezone";

/** One project's groups, in their order. */
export async function getGroups(projectId: string) {
	const workspace = await requireWorkspace();
	if (!(await isOwnedProject(projectId, workspace.id))) throw new Error("Forbidden");

	return db
		.select({ id: seiryuGroups.id, name: seiryuGroups.name, position: seiryuGroups.position })
		.from(seiryuGroups)
		.where(eq(seiryuGroups.projectId, projectId))
		.orderBy(asc(seiryuGroups.position));
}

export async function createGroup(
	input: unknown,
): Promise<{ error: string } | { success: true; data: { id: string; position: string } }> {
	const workspace = await requireWorkspace();

	const parsed = createGroupSchema.safeParse(input);
	if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

	const { id, projectId, name } = parsed.data;
	if (!(await isOwnedProject(projectId, workspace.id))) return { error: "Project not found" };

	const existing = await getGroups(projectId);
	const same = existing.find((g) => g.id === id || g.name.toLowerCase() === name.toLowerCase());
	if (same) return { success: true, data: { id: same.id, position: same.position } };

	const position = generateKeyBetween(existing.at(-1)?.position ?? null, null);
	const [group] = await db
		.insert(seiryuGroups)
		.values({ id, projectId, name, position })
		.onConflictDoNothing()
		.returning({ id: seiryuGroups.id, position: seiryuGroups.position });
	if (!group) return { error: "A group with this name already exists" };

	revalidatePath(`/seiryu/${projectId}`);
	return { success: true, data: group };
}

export async function updateGroup(input: unknown): Promise<{ error: string } | { success: true }> {
	const workspace = await requireWorkspace();

	const parsed = updateGroupSchema.safeParse(input);
	if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

	const { groupId, ...updates } = parsed.data;
	const group = await getOwnedGroup(groupId, workspace.id);
	if (!group) return { error: "Group not found" };
	if (!updates.name && !updates.position) return { success: true };

	try {
		await db.update(seiryuGroups).set(updates).where(eq(seiryuGroups.id, groupId));
	} catch {
		return { error: "A group with this name already exists" };
	}

	revalidatePath(`/seiryu/${group.projectId}`);
	return { success: true };
}

/** The group goes; its cards stay, in no group. */
export async function deleteGroup(input: unknown): Promise<{ error: string } | { success: true }> {
	const workspace = await requireWorkspace();

	const parsed = deleteGroupSchema.safeParse(input);
	if (!parsed.success) return { error: "Invalid input" };

	const group = await getOwnedGroup(parsed.data.groupId, workspace.id);
	if (!group) return { error: "Group not found" };

	await db.delete(seiryuGroups).where(eq(seiryuGroups.id, parsed.data.groupId));

	revalidatePath(`/seiryu/${group.projectId}`);
	return { success: true };
}

/**
 * A group as a template: every card it ever had (archived too) again, open, in the project's
 * first lane, in a new group — checklists unticked, due dates moved so the earliest lands on
 * `firstDue` (Black Week this year from last year's).
 */
export async function copyGroup(
	input: unknown,
): Promise<{ error: string } | { success: true; data: { id: string; cards: number } }> {
	const workspace = await requireWorkspace();

	const parsed = copyGroupSchema.safeParse(input);
	if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
	const { groupId, name, firstDue } = parsed.data;

	const group = await getOwnedGroup(groupId, workspace.id);
	if (!group) return { error: "Group not found" };
	const { projectId } = group;

	const [cards, [lane], groups, timeZone] = await Promise.all([
		db.query.seiryuCards.findMany({
			where: eq(seiryuCards.groupId, groupId),
			orderBy: [asc(seiryuCards.dueDate), asc(seiryuCards.position)],
			with: { checklistItems: { orderBy: asc(seiryuChecklistItems.position) }, cardLabels: true },
		}),
		db
			.select({ id: seiryuColumns.id })
			.from(seiryuColumns)
			.where(and(eq(seiryuColumns.projectId, projectId), eq(seiryuColumns.isDone, false)))
			.orderBy(asc(seiryuColumns.position))
			.limit(1),
		getGroups(projectId),
		getUserTimeZone(),
	]);
	if (!lane) return { error: "The project has no open column" };
	if (groups.some((g) => g.name.toLowerCase() === name.toLowerCase()))
		return { error: "A group with this name already exists" };

	const earliest = cards.find((c) => c.dueDate)?.dueDate ?? null;
	const shift = firstDue && earliest ? daysBetween(earliest, firstDue) : 0;
	const [last] = await db
		.select({ position: seiryuCards.position })
		.from(seiryuCards)
		.where(and(eq(seiryuCards.columnId, lane.id), isNull(seiryuCards.archivedAt)))
		.orderBy(desc(seiryuCards.position))
		.limit(1);
	const keys = generateNKeysBetween(last?.position ?? null, null, cards.length);

	const id = await db.transaction(async (tx) => {
		const [made] = await tx
			.insert(seiryuGroups)
			.values({
				projectId,
				name,
				position: generateKeyBetween(groups.at(-1)?.position ?? null, null),
			})
			.returning({ id: seiryuGroups.id });
		if (!made) throw new Error("Group not created");
		for (const [i, card] of cards.entries()) {
			const due = {
				dueDate: card.dueDate ? addDays(card.dueDate, shift) : null,
				dueTime: shortTime(card.dueTime),
				remindMinutes: card.remindMinutes,
			};
			const [copy] = await tx
				.insert(seiryuCards)
				.values({
					projectId,
					columnId: lane.id,
					groupId: made.id,
					title: card.title,
					description: card.description,
					priority: card.priority,
					...due,
					// A reminder already past would go off at once: none for those.
					remindAt: futureOnly(reminderAt(due, timeZone)),
					repeatEvery: card.repeatEvery,
					repeatUnit: card.repeatUnit,
					repeatFromDone: card.repeatFromDone,
					position: keys[i] as string,
				})
				.returning({ id: seiryuCards.id });
			if (!copy) continue;
			if (card.checklistItems.length > 0)
				await tx.insert(seiryuChecklistItems).values(
					card.checklistItems.map((item) => ({
						cardId: copy.id,
						title: item.title,
						position: item.position,
					})),
				);
			if (card.cardLabels.length > 0)
				await tx
					.insert(seiryuCardLabels)
					.values(card.cardLabels.map((l) => ({ cardId: copy.id, labelId: l.labelId })));
		}
		return made.id;
	});

	revalidatePath("/seiryu", "layout");
	revalidateShell();
	return { success: true, data: { id, cards: cards.length } };
}

const futureOnly = (at: Date | null) => (at && at.getTime() > Date.now() ? at : null);
