"use server";

import {
	type KeizokuHabit,
	getOwnedHabit,
	isLoggableDay,
	isOwnedHabit,
} from "@/features/keizoku/actions/guard";
import { dayNoteSchema } from "@/features/keizoku/lib/keizoku-schemas";
import {
	type StreakResult,
	computeStreak,
	firstDay,
	isDue,
	lastDays,
	thisWeek,
} from "@/features/keizoku/lib/streak";
import { getCurrentWorkspace } from "@/lib/session";
import { dayIn, getUserTimeZone, getUserToday } from "@/lib/timezone";
import {
	and,
	asc,
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
	or,
} from "@seikatsu/db";
import { del, put } from "@vercel/blob";
import { revalidatePath } from "next/cache";
import { after } from "next/server";

type Result = { error: string } | { success: true };

/** A day of one habit: done when it has a log; the note and photo hang off a done day. */
export interface DayCell {
	date: string;
	done: boolean;
	note: string | null;
	photoUrl: string | null;
}

export interface TodayHabit {
	habit: KeizokuHabit;
	/** The last 7 days, oldest first; the last one is today. */
	days: DayCell[];
	/** On today's list (a weekday habit off its days is not). */
	due: boolean;
	streak: StreakResult;
	/** Check-ins since Monday, for weekly targets. */
	week: number;
	/** The habit's first day (YYYY-MM-DD): nothing before it was ever due. */
	start: string;
}

const PHOTO_MAX = 5 * 1024 * 1024;
const PHOTO_TYPES: Record<string, string> = {
	"image/jpeg": "jpg",
	"image/png": "png",
	"image/webp": "webp",
	"image/gif": "gif",
	"image/heic": "heic",
	"image/heif": "heif",
};

function revalidate(habitId: string) {
	revalidatePath("/keizoku", "layout");
	revalidatePath("/");
	revalidatePath(`/keizoku/${habitId}`);
}

/** Photos that left a log go from Blob once the response is out; a failure only leaks a file. */
function dropPhotos(urls: (string | null | undefined)[]) {
	const gone = urls.filter((u): u is string => !!u);
	if (gone.length > 0) after(() => del(gone).catch(() => undefined));
}

/** Today's list: every active habit with its week, its run and whether it's due today. */
export async function getTodayHabits(today: string): Promise<TodayHabit[]> {
	const ws = await getCurrentWorkspace();
	if (!ws) return [];

	const [habits, zone] = await Promise.all([
		db
			.select()
			.from(keizokuHabits)
			.where(and(eq(keizokuHabits.workspaceId, ws.id), isNull(keizokuHabits.archivedAt)))
			.orderBy(asc(keizokuHabits.timeOfDay), asc(keizokuHabits.createdAt)),
		getUserTimeZone(),
	]);
	if (habits.length === 0) return [];

	const ids = habits.map((h) => h.id);
	const week = lastDays(today, 7);
	const [dates, recent] = await Promise.all([
		// Only (habit, day) pairs: the run needs every day, nothing else.
		db
			.select({ habitId: keizokuHabitLogs.habitId, date: keizokuHabitLogs.date })
			.from(keizokuHabitLogs)
			.where(and(inArray(keizokuHabitLogs.habitId, ids), lte(keizokuHabitLogs.date, today))),
		db
			.select()
			.from(keizokuHabitLogs)
			.where(
				and(
					inArray(keizokuHabitLogs.habitId, ids),
					gte(keizokuHabitLogs.date, week[0]),
					lte(keizokuHabitLogs.date, today),
				),
			),
	]);

	const datesByHabit = new Map<string, string[]>();
	for (const l of dates) {
		const list = datesByHabit.get(l.habitId);
		if (list) list.push(l.date);
		else datesByHabit.set(l.habitId, [l.date]);
	}
	const recentByKey = new Map(recent.map((l) => [`${l.habitId}:${l.date}`, l]));

	return habits.map((habit) => {
		const logDates = datesByHabit.get(habit.id) ?? [];
		return {
			habit,
			days: week.map((date) => {
				const log = recentByKey.get(`${habit.id}:${date}`);
				return {
					date,
					done: !!log,
					note: log?.note ?? null,
					photoUrl: log?.photoUrl ?? null,
				};
			}),
			due: isDue(habit, today),
			streak: computeStreak(habit, logDates, today),
			week: thisWeek(logDates, today),
			start: firstDay(dayIn(zone, habit.createdAt), logDates),
		};
	});
}

/** The home card's list: habits due today and whether each is done. */
export async function getDueToday(): Promise<
	{ habit: KeizokuHabit; done: boolean; today: string }[]
> {
	const ws = await getCurrentWorkspace();
	if (!ws) return [];
	const today = await getUserToday();
	const habits = await db
		.select()
		.from(keizokuHabits)
		.where(and(eq(keizokuHabits.workspaceId, ws.id), isNull(keizokuHabits.archivedAt)))
		.orderBy(asc(keizokuHabits.timeOfDay), asc(keizokuHabits.createdAt));
	const due = habits.filter((h) => isDue(h, today));
	if (due.length === 0) return [];
	const done = await db
		.select({ habitId: keizokuHabitLogs.habitId })
		.from(keizokuHabitLogs)
		.where(
			and(
				inArray(
					keizokuHabitLogs.habitId,
					due.map((h) => h.id),
				),
				eq(keizokuHabitLogs.date, today),
			),
		);
	const doneIds = new Set(done.map((d) => d.habitId));
	return due.map((habit) => ({ habit, done: doneIds.has(habit.id), today }));
}

/** Marks a day done — today or any day before it. Checking a done day again changes nothing. */
export async function checkDay(habitId: string, date: string): Promise<Result> {
	const [habit, today] = await Promise.all([getOwnedHabit(habitId), getUserToday()]);
	if (!habit) return { error: "Habit not found" };
	if (!isLoggableDay(date, today)) return { error: "That day can't be checked in." };

	await db
		.insert(keizokuHabitLogs)
		.values({ habitId, date })
		.onConflictDoNothing({ target: [keizokuHabitLogs.habitId, keizokuHabitLogs.date] });

	revalidate(habitId);
	return { success: true };
}

/** Clears a day, with its note and photo (the client asks first when there are any). */
export async function uncheckDay(habitId: string, date: string): Promise<Result> {
	const habit = await getOwnedHabit(habitId);
	if (!habit) return { error: "Habit not found" };

	const removed = await db
		.delete(keizokuHabitLogs)
		.where(and(eq(keizokuHabitLogs.habitId, habitId), eq(keizokuHabitLogs.date, date)))
		.returning({ photoUrl: keizokuHabitLogs.photoUrl });
	dropPhotos(removed.map((r) => r.photoUrl));

	revalidate(habitId);
	return { success: true };
}

/**
 * The note and photo of a done day. `photoFile` replaces the photo, `removePhoto` clears it;
 * otherwise the photo stays. The old file leaves Blob once it's no longer referenced.
 */
export async function saveDayNote(formData: FormData): Promise<Result> {
	const parsed = dayNoteSchema.safeParse({
		habitId: formData.get("habitId"),
		date: formData.get("date"),
		note: formData.get("note") ?? "",
		removePhoto: formData.get("removePhoto") === "1",
	});
	if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
	const { habitId, date, note, removePhoto } = parsed.data;

	const habit = await getOwnedHabit(habitId);
	if (!habit) return { error: "Habit not found" };
	const [log] = await db
		.select()
		.from(keizokuHabitLogs)
		.where(and(eq(keizokuHabitLogs.habitId, habitId), eq(keizokuHabitLogs.date, date)))
		.limit(1);
	if (!log) return { error: "Check the day in first." };

	let photoUrl = removePhoto ? null : log.photoUrl;
	const file = formData.get("photoFile");
	if (file instanceof File && file.size > 0) {
		const ext = PHOTO_TYPES[file.type];
		if (!ext) return { error: "Use a JPEG, PNG, WebP, GIF or HEIC photo." };
		if (file.size > PHOTO_MAX) return { error: "The photo must be under 5 MB." };
		try {
			const blob = await put(`habit-logs/${habit.workspaceId}/${habit.id}/${date}.${ext}`, file, {
				access: "public",
				// Every upload gets its own name: a second photo for the day never collides.
				addRandomSuffix: true,
			});
			photoUrl = blob.url;
		} catch {
			return { error: "Couldn't upload the photo. Try again in a moment." };
		}
	}

	await db.update(keizokuHabitLogs).set({ note, photoUrl }).where(eq(keizokuHabitLogs.id, log.id));
	if (log.photoUrl && log.photoUrl !== photoUrl) dropPhotos([log.photoUrl]);

	revalidate(habitId);
	return { success: true };
}

/** One habit's days in [from, to], newest first. */
export async function getHabitDays(habitId: string, from: string, to: string): Promise<DayCell[]> {
	if (!(await isOwnedHabit(habitId))) return [];
	const logs = await db
		.select()
		.from(keizokuHabitLogs)
		.where(
			and(
				eq(keizokuHabitLogs.habitId, habitId),
				gte(keizokuHabitLogs.date, from),
				lte(keizokuHabitLogs.date, to),
			),
		)
		.orderBy(desc(keizokuHabitLogs.date));
	return logs.map((l) => ({ date: l.date, done: true, note: l.note, photoUrl: l.photoUrl }));
}

/** The days with words or a picture, newest first: what the habit remembers. */
export async function getHabitJournal(habitId: string): Promise<DayCell[]> {
	if (!(await isOwnedHabit(habitId))) return [];
	const logs = await db
		.select()
		.from(keizokuHabitLogs)
		.where(
			and(
				eq(keizokuHabitLogs.habitId, habitId),
				or(isNotNull(keizokuHabitLogs.note), isNotNull(keizokuHabitLogs.photoUrl)),
			),
		)
		.orderBy(desc(keizokuHabitLogs.date))
		.limit(60);
	return logs.map((l) => ({ date: l.date, done: true, note: l.note, photoUrl: l.photoUrl }));
}
