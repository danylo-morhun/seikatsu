"use server";

import { type KeizokuHabit, getOwnedHabit } from "@/features/keizoku/actions/guard";
import {
	type HabitFormValues,
	type HabitPatch,
	habitFormSchema,
	habitPatchSchema,
} from "@/features/keizoku/lib/keizoku-schemas";
import { getCurrentWorkspace, requireWorkspace } from "@/lib/session";
import {
	and,
	asc,
	count,
	db,
	desc,
	eq,
	isNotNull,
	isNull,
	keizokuHabitLogs,
	keizokuHabits,
} from "@seikatsu/db";
import { del } from "@vercel/blob";
import { revalidatePath } from "next/cache";
import { after } from "next/server";

export type { KeizokuHabit };
export type ArchivedHabit = KeizokuHabit & { checkIns: number };

type Result<T = undefined> =
	| { error: string }
	| ({ success: true } & (T extends undefined ? object : { data: T }));

function revalidate(habitId?: string) {
	revalidatePath("/keizoku", "layout");
	revalidatePath("/settings/keizoku");
	revalidatePath("/");
	if (habitId) revalidatePath(`/keizoku/${habitId}`);
}

/** Active habits in the day's order: morning, anytime, evening, then oldest first. */
export async function getHabits(): Promise<KeizokuHabit[]> {
	const ws = await getCurrentWorkspace();
	if (!ws) return [];
	return (
		db
			.select()
			.from(keizokuHabits)
			.where(and(eq(keizokuHabits.workspaceId, ws.id), isNull(keizokuHabits.archivedAt)))
			// The enum sorts in its declared order: morning, anytime, evening.
			.orderBy(asc(keizokuHabits.timeOfDay), asc(keizokuHabits.createdAt))
	);
}

/** Archived habits, newest first, with how many check-ins deleting one would take with it. */
export async function getArchivedHabits(): Promise<ArchivedHabit[]> {
	const ws = await getCurrentWorkspace();
	if (!ws) return [];
	const [habits, counts] = await Promise.all([
		db
			.select()
			.from(keizokuHabits)
			.where(and(eq(keizokuHabits.workspaceId, ws.id), isNotNull(keizokuHabits.archivedAt)))
			.orderBy(desc(keizokuHabits.archivedAt)),
		db
			.select({ habitId: keizokuHabitLogs.habitId, n: count() })
			.from(keizokuHabitLogs)
			.innerJoin(keizokuHabits, eq(keizokuHabits.id, keizokuHabitLogs.habitId))
			.where(and(eq(keizokuHabits.workspaceId, ws.id), isNotNull(keizokuHabits.archivedAt)))
			.groupBy(keizokuHabitLogs.habitId),
	]);
	const byHabit = new Map(counts.map((c) => [c.habitId, Number(c.n)]));
	return habits.map((h) => ({ ...h, checkIns: byHabit.get(h.id) ?? 0 }));
}

/** Days and target only for the schedule that uses them. */
function scheduleFields(
	v: Pick<HabitFormValues, "frequencyType" | "frequencyDays" | "frequencyTarget">,
) {
	return {
		frequencyType: v.frequencyType,
		frequencyDays:
			v.frequencyType === "weekdays"
				? [...new Set(v.frequencyDays ?? [])].sort((a, b) => a - b)
				: null,
		frequencyTarget: v.frequencyType === "times_per_week" ? (v.frequencyTarget ?? null) : null,
	};
}

export async function createHabit(values: HabitFormValues): Promise<Result<KeizokuHabit>> {
	const ws = await requireWorkspace();
	const parsed = habitFormSchema.safeParse(values);
	if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
	const v = parsed.data;

	const [habit] = await db
		.insert(keizokuHabits)
		.values({
			workspaceId: ws.id,
			name: v.name,
			emoji: v.emoji,
			timeOfDay: v.timeOfDay,
			...scheduleFields(v),
		})
		.returning();

	revalidate();
	return { success: true, data: habit };
}

/** Saves only the fields that changed; the habit they make must still be whole. */
export async function updateHabit(habitId: string, patch: HabitPatch): Promise<Result> {
	const habit = await getOwnedHabit(habitId);
	if (!habit) return { error: "Habit not found" };

	const parsedPatch = habitPatchSchema.safeParse(patch);
	if (!parsedPatch.success)
		return { error: parsedPatch.error.issues[0]?.message ?? "Invalid input" };
	const parsed = habitFormSchema.safeParse({ ...habit, ...parsedPatch.data });
	if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
	const v = parsed.data;

	await db
		.update(keizokuHabits)
		.set({ name: v.name, emoji: v.emoji, timeOfDay: v.timeOfDay, ...scheduleFields(v) })
		.where(eq(keizokuHabits.id, habitId));

	revalidate(habitId);
	return { success: true };
}

export async function archiveHabit(habitId: string): Promise<Result> {
	const habit = await getOwnedHabit(habitId);
	if (!habit) return { error: "Habit not found" };
	await db
		.update(keizokuHabits)
		.set({ archivedAt: new Date() })
		.where(eq(keizokuHabits.id, habitId));
	revalidate(habitId);
	return { success: true };
}

export async function unarchiveHabit(habitId: string): Promise<Result> {
	const habit = await getOwnedHabit(habitId);
	if (!habit) return { error: "Habit not found" };
	await db.update(keizokuHabits).set({ archivedAt: null }).where(eq(keizokuHabits.id, habitId));
	revalidate(habitId);
	return { success: true };
}

/** Deletes the habit with its history; its photos leave Blob after the response. */
export async function deleteHabit(habitId: string): Promise<Result> {
	const habit = await getOwnedHabit(habitId);
	if (!habit) return { error: "Habit not found" };

	const photos = await db
		.select({ url: keizokuHabitLogs.photoUrl })
		.from(keizokuHabitLogs)
		.where(and(eq(keizokuHabitLogs.habitId, habitId), isNotNull(keizokuHabitLogs.photoUrl)));

	// Logs go with it (ON DELETE CASCADE).
	await db.delete(keizokuHabits).where(eq(keizokuHabits.id, habitId));

	const urls = photos.map((p) => p.url).filter((u): u is string => !!u);
	if (urls.length > 0) after(() => del(urls).catch(() => undefined));

	revalidate();
	return { success: true };
}
