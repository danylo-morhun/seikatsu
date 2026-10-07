// Shared ownership guards for seiryu server actions.
// Not a "use server" module — these are helpers called inside server actions.

import { and, db, eq, seiryuProjects } from "@seikatsu/db";
import { cache } from "react";

/**
 * True if the project belongs to the workspace. Cached per request: the board page loads
 * columns, cards and labels in parallel, and each checks the same project.
 */
export const isOwnedProject = cache(async (projectId: string, workspaceId: string) => {
	const [project] = await db
		.select({ id: seiryuProjects.id })
		.from(seiryuProjects)
		.where(and(eq(seiryuProjects.id, projectId), eq(seiryuProjects.workspaceId, workspaceId)))
		.limit(1);
	return project != null;
});
