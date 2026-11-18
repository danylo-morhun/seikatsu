"use server";

// The week's writes: its focus (which also closes the week before), and ticking an item.
// Set-style, so the offline replay can run them twice.

import { and, db, eq, weekPlans } from "@seikatsu/db";
import { revalidatePath } from "next/cache";
import type { z } from "zod";
import { addDays } from "@/features/seiryu/lib/filters";
import { weekSaveSchema, weekTickSchema } from "@/features/week/lib/plan-schemas";
import { mondayOf } from "@/features/week/lib/rhythm";
import { revalidateShell } from "@/lib/revalidate";
import { requireWorkspace } from "@/lib/session";

type Result = { error: string } | { success: true };

function refresh() {
	revalidateShell();
	revalidatePath("/week/plan");
	revalidatePath("/morning");
}

/** The week's focus: the week is planned, and the one before it looked back on. */
export async function saveWeek(input: z.input<typeof weekSaveSchema>): Promise<Result> {
	const ws = await requireWorkspace();
	const parsed = weekSaveSchema.safeParse(input);
	if (!parsed.success) return { error: "Pick up to three things" };
	const { focus } = parsed.data;
	const weekStart = mondayOf(parsed.data.weekStart);
	const now = new Date();
	await db.transaction(async (tx) => {
		await tx
			.insert(weekPlans)
			.values({ workspaceId: ws.id, weekStart, focus, plannedAt: now })
			.onConflictDoUpdate({
				target: [weekPlans.workspaceId, weekPlans.weekStart],
				set: { focus, plannedAt: now, updatedAt: now },
			});
		await tx
			.insert(weekPlans)
			.values({ workspaceId: ws.id, weekStart: addDays(weekStart, -7), closedAt: now })
			.onConflictDoUpdate({
				target: [weekPlans.workspaceId, weekPlans.weekStart],
				set: { closedAt: now, updatedAt: now },
			});
	});
	refresh();
	return { success: true };
}

/** Marks a focus item done (or not) by hand. */
export async function tickFocus(input: z.input<typeof weekTickSchema>): Promise<Result> {
	const ws = await requireWorkspace();
	const parsed = weekTickSchema.safeParse(input);
	if (!parsed.success) return { error: "Can't tick that" };
	const { key, done } = parsed.data;
	const weekStart = mondayOf(parsed.data.weekStart);
	const where = and(eq(weekPlans.workspaceId, ws.id), eq(weekPlans.weekStart, weekStart));
	const plan = await db.query.weekPlans.findFirst({ where });
	if (!plan) return { error: "Plan the week first" };
	const rest = plan.ticked.filter((k) => k !== key);
	await db
		.update(weekPlans)
		.set({ ticked: done ? [...rest, key] : rest, updatedAt: new Date() })
		.where(where);
	refresh();
	return { success: true };
}
