import type { NotificationPrefs } from "@seikatsu/db";
import type { LocalClock } from "@/features/pwa/lib/schedule";

/** What one cron tick knows about a subscribed workspace. */
export interface NotifyContext {
	workspaceId: string;
	prefs: NotificationPrefs;
	clock: LocalClock;
}

/** Each app's scheduled check: sends what's due (via `sendOnce`), returns how many it sent. */
export type Notifier = (ctx: NotifyContext) => Promise<number>;
