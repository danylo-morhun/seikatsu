// Rows put off with "Later". Read by the agenda (lib/agenda), so the list leaves them out.

import { and, daySnoozes, db, eq, gt } from "@seikatsu/db";

/** Rows still put off on `today`. */
export function readSnoozes(workspaceId: string, today: string) {
	return db
		.select({ key: daySnoozes.key, until: daySnoozes.until })
		.from(daySnoozes)
		.where(and(eq(daySnoozes.workspaceId, workspaceId), gt(daySnoozes.until, today)));
}
