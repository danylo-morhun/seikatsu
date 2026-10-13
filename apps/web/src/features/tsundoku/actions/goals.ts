"use server";

import { requireWorkspace } from "@/features/tsundoku/actions/guard";
import { setGoalSchema } from "@/features/tsundoku/lib/tsundoku-schemas";
import { and, db, eq, tsundokuGoals } from "@seikatsu/db";
import { revalidatePath } from "next/cache";

export type TsundokuGoal = typeof tsundokuGoals.$inferSelect;

export async function getGoal(year: number): Promise<TsundokuGoal | null> {
	const workspace = await requireWorkspace();
	const [goal] = await db
		.select()
		.from(tsundokuGoals)
		.where(and(eq(tsundokuGoals.workspaceId, workspace.id), eq(tsundokuGoals.year, year)))
		.limit(1);
	return goal ?? null;
}

export async function setGoal(input: unknown): Promise<{ error: string } | { success: true }> {
	const workspace = await requireWorkspace();
	const parsed = setGoalSchema.safeParse(input);
	if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
	const { year, targetBooks } = parsed.data;

	await db
		.insert(tsundokuGoals)
		.values({ workspaceId: workspace.id, year, targetBooks })
		.onConflictDoUpdate({
			target: [tsundokuGoals.workspaceId, tsundokuGoals.year],
			set: { targetBooks },
		});

	revalidatePath("/tsundoku", "layout");
	return { success: true };
}

export async function clearGoal(year: number): Promise<{ error: string } | { success: true }> {
	const workspace = await requireWorkspace();
	if (!Number.isInteger(year)) return { error: "Invalid year" };
	await db
		.delete(tsundokuGoals)
		.where(and(eq(tsundokuGoals.workspaceId, workspace.id), eq(tsundokuGoals.year, year)));
	revalidatePath("/tsundoku", "layout");
	return { success: true };
}
