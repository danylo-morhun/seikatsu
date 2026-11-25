// After a write the shell shows (revalidateShell), seikatsu's rows are sent to Google once the
// response is out — only when an account is connected, and never from inside a sync itself.

import { db, eq, googleAccounts } from "@seikatsu/db";
import { after } from "next/server";
import { getCurrentWorkspace } from "@/lib/session";

export function pushToGoogleSoon() {
	try {
		after(async () => {
			const { inSync, syncGoogle } = await import("@/features/calendar/google/sync");
			if (inSync()) return;
			const ws = await getCurrentWorkspace();
			if (!ws) return;
			const [linked] = await db
				.select({ id: googleAccounts.workspaceId })
				.from(googleAccounts)
				.where(eq(googleAccounts.workspaceId, ws.id));
			if (linked) await syncGoogle(ws.id, { pull: false });
		});
	} catch {
		// Outside a request (a script, a test): nothing to send after.
	}
}
