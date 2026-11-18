import { date, jsonb, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { workspaces } from "./kuroji";

/** One thing chosen for the day, as it read when chosen (the row may have gone since). */
export type DayPick = {
	/** The queue key it came from (`seiryu:<card id>`, `kuroji:captures`…). */
	key: string;
	title: string;
	href: string;
	/** The app's route ("/seiryu") or "/goals". */
	app: string;
};

/**
 * The day's plan: up to three things picked in the morning, ticked through the day, closed in
 * the evening. One row per user-local day; no row = the morning hasn't been planned.
 */
export const dayPlans = pgTable(
	"day_plans",
	{
		workspaceId: uuid("workspace_id")
			.notNull()
			.references(() => workspaces.id, { onDelete: "cascade" }),
		day: date("day").notNull(),
		picks: jsonb("picks").$type<DayPick[]>().notNull().default([]),
		/** Keys of picks marked done by hand (an app's own act marks the rest done). */
		ticked: text("ticked").array().notNull().default([]),
		plannedAt: timestamp("planned_at", { withTimezone: true }),
		closedAt: timestamp("closed_at", { withTimezone: true }),
		updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [primaryKey({ columns: [t.workspaceId, t.day] })],
);

/**
 * "Later" on a row of the day's list that has no date of its own (payments to add, quiet
 * applications, a fund's instalment…): it stays off the list until `until`. Seiryu cards move
 * their own due date instead.
 */
export const daySnoozes = pgTable(
	"day_snoozes",
	{
		workspaceId: uuid("workspace_id")
			.notNull()
			.references(() => workspaces.id, { onDelete: "cascade" }),
		key: text("key").notNull(),
		/** The first day it shows again. */
		until: date("until").notNull(),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [primaryKey({ columns: [t.workspaceId, t.key] })],
);

export type DayPlan = typeof dayPlans.$inferSelect;
export type DaySnooze = typeof daySnoozes.$inferSelect;
