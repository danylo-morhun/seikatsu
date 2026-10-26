import { boolean, pgTable, primaryKey, text, time, timestamp, uuid } from "drizzle-orm/pg-core";
import { workspaces } from "./kuroji";

/** One browser/device that accepted push. Dropped when the push service says it's gone. */
export const pushSubscriptions = pgTable("push_subscriptions", {
	id: uuid("id").primaryKey().defaultRandom(),
	workspaceId: uuid("workspace_id")
		.notNull()
		.references(() => workspaces.id, { onDelete: "cascade" }),
	endpoint: text("endpoint").notNull().unique(),
	p256dh: text("p256dh").notNull(),
	auth: text("auth").notNull(),
	userAgent: text("user_agent"),
	createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	lastSuccessAt: timestamp("last_success_at", { withTimezone: true }),
});

/**
 * What to send and when, in the user's own zone. The cron has no `tz` cookie, so the zone is
 * saved from the browser whenever these change or a device subscribes.
 */
export const notificationPrefs = pgTable("notification_prefs", {
	workspaceId: uuid("workspace_id")
		.primaryKey()
		.references(() => workspaces.id, { onDelete: "cascade" }),
	timeZone: text("time_zone").notNull().default("UTC"),
	morningTime: time("morning_time").notNull().default("09:00"),
	keizokuEnabled: boolean("keizoku_enabled").notNull().default(true),
	keizokuTime: time("keizoku_time").notNull().default("21:00"),
	kyuuEnabled: boolean("kyuu_enabled").notNull().default(true),
	aishaEnabled: boolean("aisha_enabled").notNull().default(true),
	kurojiRecurring: boolean("kuroji_recurring").notNull().default(true),
	kurojiBudget: boolean("kuroji_budget").notNull().default(true),
	kurojiWeekly: boolean("kuroji_weekly").notNull().default(true),
	updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Every notification sent, keyed so a re-run cron (or a retry) never sends one twice. */
export const notificationLog = pgTable(
	"notification_log",
	{
		workspaceId: uuid("workspace_id")
			.notNull()
			.references(() => workspaces.id, { onDelete: "cascade" }),
		key: text("key").notNull(),
		sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [primaryKey({ columns: [t.workspaceId, t.key] })],
);

export type NotificationPrefs = typeof notificationPrefs.$inferSelect;
