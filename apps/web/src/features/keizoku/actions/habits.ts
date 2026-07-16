"use server";

import { getOwnedHabit, getOwnedWorkspace } from "@/features/keizoku/actions/guard";
import { type HabitFormValues, habitFormSchema } from "@/features/keizoku/lib/keizoku-schemas";
import {
	and,
	db,
	desc,
	eq,
	isNotNull,
	isNull,
	keizokuHabitLogs,
	keizokuHabits,
} from "@seikatsu/db";
import { revalidatePath } from "next/cache";

export type KeizokuHabit = typeof keizokuHabits.$inferSelect;

export async function getHabits(workspaceId: string): Promise<KeizokuHabit[]> {
	const ws = await getOwnedWorkspace(workspaceId);
	if (!ws) return [];
	return db
		.select()
		.from(keizokuHabits)
		.where(and(eq(keizokuHabits.workspaceId, workspaceId), isNull(keizokuHabits.archivedAt)))
		.orderBy(keizokuHabits.createdAt);
}

export async function getArchivedHabits(workspaceId: string): Promise<KeizokuHabit[]> {
	const ws = await getOwnedWorkspace(workspaceId);
	if (!ws) return [];
	return db
		.select()
		.from(keizokuHabits)
		.where(and(eq(keizokuHabits.workspaceId, workspaceId), isNotNull(keizokuHabits.archivedAt)))
		.orderBy(desc(keizokuHabits.archivedAt));
}

function frequencyFields(v: HabitFormValues) {
	return {
		frequencyType: v.frequencyType,
		frequencyDays: v.frequencyType === "weekdays" ? (v.frequencyDays ?? null) : null,
		frequencyTarget: v.frequencyType === "times_per_week" ? (v.frequencyTarget ?? null) : null,
	};
}

export async function createHabit(
	workspaceId: string,
	values: HabitFormValues,
): Promise<{ error: string } | { success: true; data: KeizokuHabit }> {
	const ws = await getOwnedWorkspace(workspaceId);
	if (!ws) return { error: "Forbidden" };

	const parsed = habitFormSchema.safeParse(values);
	if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
	const v = parsed.data;

	const [habit] = await db
		.insert(keizokuHabits)
		.values({
			workspaceId,
			name: v.name,
			emoji: v.emoji,
			timeOfDay: v.timeOfDay,
			requiresPhoto: v.requiresPhoto,
			...frequencyFields(v),
		})
		.returning();

	revalidatePath("/keizoku");
	return { success: true, data: habit };
}

export async function updateHabit(
	habitId: string,
	values: HabitFormValues,
): Promise<{ error: string } | { success: true }> {
	const habit = await getOwnedHabit(habitId);
	if (!habit) return { error: "Habit not found" };

	const parsed = habitFormSchema.safeParse(values);
	if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
	const v = parsed.data;

	await db
		.update(keizokuHabits)
		.set({
			name: v.name,
			emoji: v.emoji,
			timeOfDay: v.timeOfDay,
			requiresPhoto: v.requiresPhoto,
			...frequencyFields(v),
		})
		.where(eq(keizokuHabits.id, habitId));

	revalidatePath("/keizoku");
	revalidatePath(`/keizoku/${habitId}`);
	return { success: true };
}

export async function archiveHabit(
	habitId: string,
): Promise<{ error: string } | { success: true }> {
	const habit = await getOwnedHabit(habitId);
	if (!habit) return { error: "Habit not found" };
	await db
		.update(keizokuHabits)
		.set({ archivedAt: new Date() })
		.where(eq(keizokuHabits.id, habitId));
	revalidatePath("/keizoku");
	return { success: true };
}

export async function unarchiveHabit(
	habitId: string,
): Promise<{ error: string } | { success: true }> {
	const habit = await getOwnedHabit(habitId);
	if (!habit) return { error: "Habit not found" };
	await db.update(keizokuHabits).set({ archivedAt: null }).where(eq(keizokuHabits.id, habitId));
	revalidatePath("/keizoku");
	return { success: true };
}

/** Hard delete only if the habit has no logged history — otherwise the caller should archive instead. */
export async function deleteHabit(habitId: string): Promise<{ error: string } | { success: true }> {
	const habit = await getOwnedHabit(habitId);
	if (!habit) return { error: "Habit not found" };

	const [log] = await db
		.select({ id: keizokuHabitLogs.id })
		.from(keizokuHabitLogs)
		.where(eq(keizokuHabitLogs.habitId, habitId))
		.limit(1);

	if (log) {
		return { error: "This habit has logged history and can't be deleted." };
	}

	await db.delete(keizokuHabits).where(eq(keizokuHabits.id, habitId));
	revalidatePath("/keizoku");
	return { success: true };
}
