"use server";

import { getOwnedWorkspace } from "@/features/tsundoku/actions/guard";
import { type SetGoalValues, setGoalSchema } from "@/features/tsundoku/lib/tsundoku-schemas";
import { and, db, eq, tsundokuGoals } from "@seikatsu/db";
import { revalidatePath } from "next/cache";

export type TsundokuGoal = typeof tsundokuGoals.$inferSelect;

export async function getGoal(workspaceId: string, year: number): Promise<TsundokuGoal | null> {
	const ws = await getOwnedWorkspace(workspaceId);
	if (!ws) return null;
	const [goal] = await db
		.select()
		.from(tsundokuGoals)
		.where(and(eq(tsundokuGoals.workspaceId, workspaceId), eq(tsundokuGoals.year, year)))
		.limit(1);
	return goal ?? null;
}

export async function setGoal(
	workspaceId: string,
	values: SetGoalValues,
): Promise<{ error: string } | { success: true }> {
	const ws = await getOwnedWorkspace(workspaceId);
	if (!ws) return { error: "Forbidden" };

	const parsed = setGoalSchema.safeParse(values);
	if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

	await db
		.insert(tsundokuGoals)
		.values({ workspaceId, year: parsed.data.year, targetBooks: parsed.data.targetBooks })
		.onConflictDoUpdate({
			target: [tsundokuGoals.workspaceId, tsundokuGoals.year],
			set: { targetBooks: parsed.data.targetBooks },
		});

	revalidatePath("/tsundoku/stats");
	return { success: true };
}
