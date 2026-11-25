// After a write seikatsu mirrors to Google (revalidateShell with the workspace), its rows are
// sent there once the response is out — only when an account is connected, and never from
// inside a sync itself. Writes made elsewhere (bills, the car) go with the 15-minute cron.

import { db, eq, googleAccounts } from "@seikatsu/db";
import { after } from "next/server";

export function pushToGoogleSoon(workspaceId: string) {
	try {
		after(async () => {
			const { inSync, syncGoogle } = await import("@/features/calendar/google/sync");
			if (inSync()) return;
			const [linked] = await db
				.select({ id: googleAccounts.workspaceId })
				.from(googleAccounts)
				.where(eq(googleAccounts.workspaceId, workspaceId));
			if (linked) await syncGoogle(workspaceId, { pull: false });
		});
	} catch {
		// Outside a request (a script, a test): nothing to send after.
	}
}
