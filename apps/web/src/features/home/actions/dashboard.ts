"use server";

import { db, eq, workspaces } from "@seikatsu/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
	WIDGET_IDS,
	WIDGET_SIZES,
	type WidgetId,
	type WidgetSize,
} from "@/features/home/lib/dashboard";
import { requireWorkspace } from "@/lib/session";

const layoutSchema = z
	.array(
		z.object({
			id: z.enum(WIDGET_IDS as [WidgetId, ...WidgetId[]]),
			size: z.enum(WIDGET_SIZES as [WidgetSize, ...WidgetSize[]]),
			hidden: z.boolean(),
		}),
	)
	.max(WIDGET_IDS.length)
	.refine((slots) => new Set(slots.map((s) => s.id)).size === slots.length, "Repeated widget");

/** The home's widgets in their new order and sizes. Widgets of apps that are off keep their
 * stored place, so switching an app back on brings its widget back as it was. */
export async function saveDashboard(
	slots: unknown,
): Promise<{ error: string } | { success: true }> {
	const ws = await requireWorkspace();
	const parsed = layoutSchema.safeParse(slots);
	if (!parsed.success) return { error: "Couldn't save the layout" };

	const ids = new Set(parsed.data.map((s) => s.id));
	const kept = (ws.dashboard ?? []).filter((s) => !ids.has(s.id as WidgetId));
	await db
		.update(workspaces)
		.set({ dashboard: [...parsed.data, ...kept], updatedAt: new Date() })
		.where(eq(workspaces.id, ws.id));

	revalidatePath("/");
	return { success: true };
}
