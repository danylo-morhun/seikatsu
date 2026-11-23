"use server";

import { db, eq, workspaces } from "@seikatsu/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { MODULE_HREFS, type ModuleHref } from "@/lib/modules";
import { requireWorkspace } from "@/lib/session";

const moduleSchema = z.enum(MODULE_HREFS as [ModuleHref, ...ModuleHref[]]);

/** Switches a module (an app, or a shell feature like Day) off — gone everywhere — or back on.
 * Its data stays either way. */
export async function setModuleOn(
	module: string,
	on: boolean,
): Promise<{ error: string } | { success: true }> {
	const ws = await requireWorkspace();
	const parsed = moduleSchema.safeParse(module);
	if (!parsed.success) return { error: "Unknown module" };

	const rest = ws.modulesOff.filter((href) => href !== parsed.data);
	await db
		.update(workspaces)
		.set({ modulesOff: on ? rest : [...rest, parsed.data], updatedAt: new Date() })
		.where(eq(workspaces.id, ws.id));

	revalidatePath("/", "layout");
	return { success: true };
}
