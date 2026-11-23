// Server-only reads for the first-run setup. Not a "use server" module.

import { db, eq, seiryuProjects, transactions } from "@seikatsu/db";

/** Whether the workspace's main currency can still change: only before any money is recorded
 * (every amount's base value is in it). */
export async function canSetCurrency(workspaceId: string): Promise<boolean> {
	const [any] = await db
		.select({ id: transactions.id })
		.from(transactions)
		.where(eq(transactions.workspaceId, workspaceId))
		.limit(1);
	return !any;
}

/** Whether Seiryu has no boards yet (the setup then offers a first one). */
export async function hasNoBoards(workspaceId: string): Promise<boolean> {
	const [any] = await db
		.select({ id: seiryuProjects.id })
		.from(seiryuProjects)
		.where(eq(seiryuProjects.workspaceId, workspaceId))
		.limit(1);
	return !any;
}
