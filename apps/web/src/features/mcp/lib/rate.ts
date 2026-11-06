import { and, count, db, eq, gt, mcpCalls } from "@seikatsu/db";

/** Tool calls a grant may make per minute — far above a chat's pace, low enough to stop a loop. */
export const CALLS_PER_MINUTE = 120;

/** Counted from mcp_calls (already written per call), so no Redis. Approximate by design. */
export async function allowCall(grantId: string): Promise<boolean> {
	const [{ n }] = await db
		.select({ n: count() })
		.from(mcpCalls)
		.where(
			and(eq(mcpCalls.grantId, grantId), gt(mcpCalls.createdAt, new Date(Date.now() - 60_000))),
		);
	return n < CALLS_PER_MINUTE;
}
