"use server";

import { APPS_CONFIG } from "@/lib/app-themes";
import { requireWorkspace } from "@/lib/session";
import { db, eq, workspaces } from "@seikatsu/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const appSchema = z.enum(Object.keys(APPS_CONFIG) as [keyof typeof APPS_CONFIG]);

/** Sets an app aside (off the sidebar and the home) or brings it back. */
export async function setAppHidden(
	app: string,
	hidden: boolean,
): Promise<{ error: string } | { success: true }> {
	const ws = await requireWorkspace();
	const parsed = appSchema.safeParse(app);
	if (!parsed.success) return { error: "Unknown app" };

	const rest = ws.hiddenApps.filter((href) => href !== parsed.data);
	await db
		.update(workspaces)
		.set({ hiddenApps: hidden ? [...rest, parsed.data] : rest, updatedAt: new Date() })
		.where(eq(workspaces.id, ws.id));

	revalidatePath("/", "layout");
	return { success: true };
}
