"use server";

import { getOwnedHabit, getOwnedWorkspace } from "@/features/keizoku/actions/guard";
import { logHabitSchema } from "@/features/keizoku/lib/keizoku-schemas";
import { computeStreak } from "@/features/keizoku/lib/streak";
import {
	and,
	db,
	desc,
	eq,
	gte,
	inArray,
	isNotNull,
	isNull,
	keizokuHabitLogs,
	keizokuHabits,
	lte,
} from "@seikatsu/db";
import { put } from "@vercel/blob";
import { revalidatePath } from "next/cache";

export type KeizokuHabitLog = typeof keizokuHabitLogs.$inferSelect;
type Habit = typeof keizokuHabits.$inferSelect;

export interface TodayHabit {
	habit: Habit;
	log: KeizokuHabitLog | null;
	streak: number;
}

export async function getTodayHabits(workspaceId: string, date: string): Promise<TodayHabit[]> {
	const ws = await getOwnedWorkspace(workspaceId);
	if (!ws) return [];

	const habits = await db
		.select()
		.from(keizokuHabits)
		.where(and(eq(keizokuHabits.workspaceId, workspaceId), isNull(keizokuHabits.archivedAt)))
		.orderBy(keizokuHabits.createdAt);

	if (habits.length === 0) return [];

	const habitIds = habits.map((h) => h.id);
	const [todayLogs, allLogs] = await Promise.all([
		db
			.select()
			.from(keizokuHabitLogs)
			.where(and(inArray(keizokuHabitLogs.habitId, habitIds), eq(keizokuHabitLogs.date, date))),
		db
			.select({ habitId: keizokuHabitLogs.habitId, date: keizokuHabitLogs.date })
			.from(keizokuHabitLogs)
			.where(inArray(keizokuHabitLogs.habitId, habitIds)),
	]);

	const logByHabit = new Map(todayLogs.map((l) => [l.habitId, l]));
	const datesByHabit = new Map<string, string[]>();
	for (const l of allLogs) {
		const arr = datesByHabit.get(l.habitId);
		if (arr) arr.push(l.date);
		else datesByHabit.set(l.habitId, [l.date]);
	}

	return habits.map((habit) => ({
		habit,
		log: logByHabit.get(habit.id) ?? null,
		streak: computeStreak(habit, datesByHabit.get(habit.id) ?? [], date).current,
	}));
}

export async function logHabit(
	formData: FormData,
): Promise<{ error: string } | { success: true; data: KeizokuHabitLog }> {
	const habitIdRaw = formData.get("habitId");
	const dateRaw = formData.get("date");
	const noteRaw = formData.get("note");

	const parsed = logHabitSchema.safeParse({
		habitId: typeof habitIdRaw === "string" ? habitIdRaw : "",
		date: typeof dateRaw === "string" ? dateRaw : "",
		note: typeof noteRaw === "string" ? noteRaw : undefined,
	});
	if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

	const habit = await getOwnedHabit(parsed.data.habitId);
	if (!habit) return { error: "Habit not found" };

	let photoUrl: string | undefined;
	const photoFile = formData.get("photoFile");
	if (photoFile instanceof File && photoFile.size > 0) {
		if (!photoFile.type.startsWith("image/")) return { error: "Only image files are allowed." };
		if (photoFile.size > 5 * 1024 * 1024) return { error: "Image must be under 5 MB." };
		const { url } = await put(
			`habit-logs/${habit.workspaceId}/${habit.id}/${parsed.data.date}-${photoFile.name}`,
			photoFile,
			{ access: "public" },
		);
		photoUrl = url;
	}

	const [log] = await db
		.insert(keizokuHabitLogs)
		.values({
			habitId: habit.id,
			date: parsed.data.date,
			note: parsed.data.note ?? null,
			photoUrl: photoUrl ?? null,
		})
		.onConflictDoUpdate({
			target: [keizokuHabitLogs.habitId, keizokuHabitLogs.date],
			set: {
				note: parsed.data.note ?? null,
				...(photoUrl ? { photoUrl } : {}),
			},
		})
		.returning();

	revalidatePath("/keizoku");
	revalidatePath(`/keizoku/${habit.id}`);
	return { success: true, data: log };
}

export async function unlogHabit(
	habitId: string,
	date: string,
): Promise<{ error: string } | { success: true }> {
	const habit = await getOwnedHabit(habitId);
	if (!habit) return { error: "Habit not found" };

	await db
		.delete(keizokuHabitLogs)
		.where(and(eq(keizokuHabitLogs.habitId, habitId), eq(keizokuHabitLogs.date, date)));

	revalidatePath("/keizoku");
	revalidatePath(`/keizoku/${habitId}`);
	return { success: true };
}

export async function getHabitLogs(
	habitId: string,
	from?: string,
	to?: string,
): Promise<KeizokuHabitLog[]> {
	const habit = await getOwnedHabit(habitId);
	if (!habit) return [];

	const conditions = [eq(keizokuHabitLogs.habitId, habitId)];
	if (from) conditions.push(gte(keizokuHabitLogs.date, from));
	if (to) conditions.push(lte(keizokuHabitLogs.date, to));

	return db
		.select()
		.from(keizokuHabitLogs)
		.where(and(...conditions))
		.orderBy(desc(keizokuHabitLogs.date));
}

export async function getHabitPhotos(habitId: string): Promise<KeizokuHabitLog[]> {
	const habit = await getOwnedHabit(habitId);
	if (!habit) return [];

	return db
		.select()
		.from(keizokuHabitLogs)
		.where(and(eq(keizokuHabitLogs.habitId, habitId), isNotNull(keizokuHabitLogs.photoUrl)))
		.orderBy(desc(keizokuHabitLogs.date));
}
