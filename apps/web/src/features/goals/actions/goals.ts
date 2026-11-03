"use server";

import { and, db, desc, eq, goalLinks, goals, isNull } from "@seikatsu/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ownsContainer } from "@/features/goals/lib/data";
import { LINK_KINDS } from "@/features/goals/lib/progress";
import { generateKeyBetween } from "@/lib/position";
import { getCurrentWorkspace } from "@/lib/session";

type Result<T = undefined> = { error: string } | { success: true; data?: T };

const goalSchema = z.object({
	name: z.string().trim().min(1, "Name the goal").max(80),
	note: z
		.string()
		.trim()
		.max(500)
		.nullable()
		.transform((v) => v || null),
	targetDate: z
		.string()
		.regex(/^\d{4}-\d{2}-\d{2}$/)
		.nullable(),
});
export type GoalInput = z.input<typeof goalSchema>;

const linkSchema = z.object({
	kind: z.enum(LINK_KINDS),
	refId: z.uuid().nullable(),
});
export type LinkInput = z.input<typeof linkSchema>;

const issue = (e: z.ZodError) => e.issues[0]?.message ?? "Invalid input";

const revalidate = () => revalidatePath("/goals");

async function ownedGoal(goalId: string, workspaceId: string) {
	if (!z.uuid().safeParse(goalId).success) return null;
	const [goal] = await db
		.select({ id: goals.id })
		.from(goals)
		.where(and(eq(goals.id, goalId), eq(goals.workspaceId, workspaceId)));
	return goal ?? null;
}

export async function createGoal(input: GoalInput): Promise<Result<{ id: string }>> {
	const ws = await getCurrentWorkspace();
	if (!ws) return { error: "Not signed in" };
	const parsed = goalSchema.safeParse(input);
	if (!parsed.success) return { error: issue(parsed.error) };
	const [last] = await db
		.select({ position: goals.position })
		.from(goals)
		.where(and(eq(goals.workspaceId, ws.id), isNull(goals.archivedAt)))
		.orderBy(desc(goals.position))
		.limit(1);
	const [row] = await db
		.insert(goals)
		.values({
			workspaceId: ws.id,
			...parsed.data,
			position: generateKeyBetween(last?.position ?? null, null),
		})
		.returning({ id: goals.id });
	if (!row) return { error: "Couldn't create the goal" };
	revalidate();
	return { success: true, data: { id: row.id } };
}

export async function updateGoal(goalId: string, input: GoalInput): Promise<Result> {
	const ws = await getCurrentWorkspace();
	if (!ws) return { error: "Not signed in" };
	if (!(await ownedGoal(goalId, ws.id))) return { error: "Goal not found" };
	const parsed = goalSchema.safeParse(input);
	if (!parsed.success) return { error: issue(parsed.error) };
	await db.update(goals).set(parsed.data).where(eq(goals.id, goalId));
	revalidate();
	return { success: true };
}

/** Reached or dropped: off the page, kept for the record. */
export async function archiveGoal(goalId: string): Promise<Result> {
	const ws = await getCurrentWorkspace();
	if (!ws) return { error: "Not signed in" };
	if (!(await ownedGoal(goalId, ws.id))) return { error: "Goal not found" };
	await db.update(goals).set({ archivedAt: new Date() }).where(eq(goals.id, goalId));
	revalidate();
	return { success: true };
}

/** Gone for good, with its links. The linked containers stay in their apps. */
export async function deleteGoal(goalId: string): Promise<Result> {
	const ws = await getCurrentWorkspace();
	if (!ws) return { error: "Not signed in" };
	if (!(await ownedGoal(goalId, ws.id))) return { error: "Goal not found" };
	await db.delete(goals).where(eq(goals.id, goalId));
	revalidate();
	return { success: true };
}

export async function addLink(goalId: string, input: LinkInput): Promise<Result> {
	const ws = await getCurrentWorkspace();
	if (!ws) return { error: "Not signed in" };
	if (!(await ownedGoal(goalId, ws.id))) return { error: "Goal not found" };
	const parsed = linkSchema.safeParse(input);
	if (!parsed.success) return { error: issue(parsed.error) };
	const { kind, refId } = parsed.data;
	if (!(await ownsContainer(ws.id, kind, refId))) return { error: "Pick something of yours" };

	// The unique index can't see a repeated null ref (the job search): check by hand.
	const existing = await db
		.select({ id: goalLinks.id })
		.from(goalLinks)
		.where(
			and(
				eq(goalLinks.goalId, goalId),
				eq(goalLinks.kind, kind),
				refId ? eq(goalLinks.refId, refId) : isNull(goalLinks.refId),
			),
		);
	if (existing.length > 0) return { error: "Already part of this goal" };

	await db.insert(goalLinks).values({ goalId, kind, refId });
	revalidate();
	return { success: true };
}

export async function removeLink(linkId: string): Promise<Result> {
	const ws = await getCurrentWorkspace();
	if (!ws) return { error: "Not signed in" };
	if (!z.uuid().safeParse(linkId).success) return { error: "Link not found" };
	const [link] = await db
		.select({ id: goalLinks.id })
		.from(goalLinks)
		.innerJoin(goals, eq(goals.id, goalLinks.goalId))
		.where(and(eq(goalLinks.id, linkId), eq(goals.workspaceId, ws.id)));
	if (!link) return { error: "Link not found" };
	await db.delete(goalLinks).where(eq(goalLinks.id, linkId));
	revalidate();
	return { success: true };
}
