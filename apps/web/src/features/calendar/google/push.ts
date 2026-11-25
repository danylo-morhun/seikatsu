// After a write seikatsu mirrors to Google (revalidateShell with the workspace), its rows are
// sent there in the background — only when an account is connected, and never from inside a
// sync itself. Writes made elsewhere (bills, the car) go with the 15-minute cron.
//
// Not after(): the action's response still streams the page, and after()'s phase made the
// page's own reads of request data fail. The server is one long-lived process (VPS), so a
// task started here simply runs on.

import { db, eq, googleAccounts } from "@seikatsu/db";
import * as Sentry from "@sentry/nextjs";

/** A moment, so the response goes out first. */
const DELAY = 250;

export function pushToGoogleSoon(workspaceId: string) {
	setTimeout(() => {
		void (async () => {
			const { inSync, syncGoogle } = await import("@/features/calendar/google/sync");
			if (inSync()) return;
			const [linked] = await db
				.select({ id: googleAccounts.workspaceId })
				.from(googleAccounts)
				.where(eq(googleAccounts.workspaceId, workspaceId));
			if (linked) await syncGoogle(workspaceId, { pull: false });
		})().catch((e) => Sentry.captureException(e, { tags: { sync: "google-push" } }));
	}, DELAY);
}
