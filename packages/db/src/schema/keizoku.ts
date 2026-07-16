import { relations } from "drizzle-orm";
import {
	boolean,
	date,
	index,
	integer,
	pgEnum,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";
import { workspaces } from "./kuroji";

export const keizokuFrequencyEnum = pgEnum("keizoku_frequency", [
	"daily",
	"weekdays",
	"times_per_week",
]);

export const keizokuHabits = pgTable(
	"keizoku_habits",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		workspaceId: uuid("workspace_id")
			.notNull()
			.references(() => workspaces.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		emoji: text("emoji").notNull(),
		frequencyType: keizokuFrequencyEnum("frequency_type").notNull(),
		frequencyDays: integer("frequency_days").array(),
		frequencyTarget: integer("frequency_target"),
		requiresPhoto: boolean("requires_photo").notNull().default(false),
		archivedAt: timestamp("archived_at", { withTimezone: true }),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [index("keizoku_habits_workspace_id_idx").on(t.workspaceId)],
);

export const keizokuHabitLogs = pgTable(
	"keizoku_habit_logs",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		habitId: uuid("habit_id")
			.notNull()
			.references(() => keizokuHabits.id, { onDelete: "cascade" }),
		date: date("date").notNull(),
		photoUrl: text("photo_url"),
		note: text("note"),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [
		uniqueIndex("keizoku_habit_logs_habit_date_idx").on(t.habitId, t.date),
		index("keizoku_habit_logs_habit_id_idx").on(t.habitId),
	],
);

export const keizokuHabitsRelations = relations(keizokuHabits, ({ one, many }) => ({
	workspace: one(workspaces, {
		fields: [keizokuHabits.workspaceId],
		references: [workspaces.id],
	}),
	logs: many(keizokuHabitLogs),
}));

export const keizokuHabitLogsRelations = relations(keizokuHabitLogs, ({ one }) => ({
	habit: one(keizokuHabits, {
		fields: [keizokuHabitLogs.habitId],
		references: [keizokuHabits.id],
	}),
}));
