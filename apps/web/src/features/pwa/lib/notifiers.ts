import type { NotificationPrefs } from "@seikatsu/db";
import type { LocalClock } from "@/features/pwa/lib/schedule";
import type { ModuleHref } from "@/lib/modules";

/** What one cron tick knows about a subscribed workspace. */
export interface NotifyContext {
	workspaceId: string;
	prefs: NotificationPrefs;
	clock: LocalClock;
	/** The modules on (lib/modules.ts): a notifier of one that's off doesn't run. All when absent. */
	on?: readonly ModuleHref[];
}

/** Each app's scheduled check: sends what's due (via `sendOnce`), returns how many it sent. */
export type Notifier = (ctx: NotifyContext) => Promise<number>;
