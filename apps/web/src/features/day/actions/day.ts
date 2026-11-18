"use server";

// The day's writes: snooze a row, save the morning's picks, tick or drop one, close the day.
// Each is set-style, so the offline replay can run it twice.

import { and, dayPlans, daySnoozes, db, eq } from "@seikatsu/db";
import { revalidatePath } from "next/cache";
import type { z } from "zod";
import {
	closeSchema,
	dropSchema,
	planSchema,
	snoozeSchema,
	tickSchema,
	unsnoozeSchema,
} from "@/features/day/lib/schemas";
import { revalidateShell } from "@/lib/revalidate";
import { requireWorkspace } from "@/lib/session";

type Result = { error: string } | { success: true };

const findPlan = (workspaceId: string, day: string) =>
	db.query.dayPlans.findFirst({
		where: and(eq(dayPlans.workspaceId, workspaceId), eq(dayPlans.day, day)),
	});

function refresh() {
	revalidateShell();
	revalidatePath("/morning");
	revalidatePath("/evening");
}

/** "Later" on a row with no date of its own: off the list until `until`. */
export async function snoozeRow(input: z.input<typeof snoozeSchema>): Promise<Result> {
	const ws = await requireWorkspace();
	const parsed = snoozeSchema.safeParse(input);
	if (!parsed.success) return { error: "Can't put that off" };
	const { key, until } = parsed.data;
	await db
		.insert(daySnoozes)
		.values({ workspaceId: ws.id, key, until })
		.onConflictDoUpdate({ target: [daySnoozes.workspaceId, daySnoozes.key], set: { until } });
	refresh();
	return { success: true };
}

/** Undo of a snooze: the row is back on today's list. */
export async function unsnoozeRow(input: z.input<typeof unsnoozeSchema>): Promise<Result> {
	const ws = await requireWorkspace();
	const parsed = unsnoozeSchema.safeParse(input);
	if (!parsed.success) return { error: "Can't bring that back" };
	await db
		.delete(daySnoozes)
		.where(and(eq(daySnoozes.workspaceId, ws.id), eq(daySnoozes.key, parsed.data.key)));
	refresh();
	return { success: true };
}

/** The morning's picks: the day is planned. Picking again replaces them. */
export async function savePlan(input: z.input<typeof planSchema>): Promise<Result> {
	const ws = await requireWorkspace();
	const parsed = planSchema.safeParse(input);
	if (!parsed.success) return { error: "Pick up to three things" };
	const { day, picks } = parsed.data;
	const now = new Date();
	await db
		.insert(dayPlans)
		.values({ workspaceId: ws.id, day, picks, plannedAt: now })
		.onConflictDoUpdate({
			target: [dayPlans.workspaceId, dayPlans.day],
			set: { picks, plannedAt: now, updatedAt: now },
		});
	refresh();
	return { success: true };
}

/** Marks a pick done (or not) by hand, for ones no app act finishes. */
export async function tickPick(input: z.input<typeof tickSchema>): Promise<Result> {
	const ws = await requireWorkspace();
	const parsed = tickSchema.safeParse(input);
	if (!parsed.success) return { error: "Can't tick that" };
	const { day, key, done } = parsed.data;
	const plan = await findPlan(ws.id, day);
	if (!plan) return { error: "Plan the day first" };
	const rest = plan.ticked.filter((k) => k !== key);
	await db
		.update(dayPlans)
		.set({ ticked: done ? [...rest, key] : rest, updatedAt: new Date() })
		.where(and(eq(dayPlans.workspaceId, ws.id), eq(dayPlans.day, day)));
	refresh();
	return { success: true };
}

/** Takes a pick off the day: it isn't carried to tomorrow. */
export async function dropPick(input: z.input<typeof dropSchema>): Promise<Result> {
	const ws = await requireWorkspace();
	const parsed = dropSchema.safeParse(input);
	if (!parsed.success) return { error: "Can't drop that" };
	const { day, key } = parsed.data;
	const plan = await findPlan(ws.id, day);
	if (!plan) return { success: true };
	await db
		.update(dayPlans)
		.set({ picks: plan.picks.filter((p) => p.key !== key), updatedAt: new Date() })
		.where(and(eq(dayPlans.workspaceId, ws.id), eq(dayPlans.day, day)));
	refresh();
	return { success: true };
}

/** The evening is done: quiet until the morning. */
export async function closeDay(input: z.input<typeof closeSchema>): Promise<Result> {
	const ws = await requireWorkspace();
	const parsed = closeSchema.safeParse(input);
	if (!parsed.success) return { error: "Can't close that day" };
	const now = new Date();
	await db
		.insert(dayPlans)
		.values({ workspaceId: ws.id, day: parsed.data.day, closedAt: now })
		.onConflictDoUpdate({
			target: [dayPlans.workspaceId, dayPlans.day],
			set: { closedAt: now, updatedAt: now },
		});
	refresh();
	return { success: true };
}
