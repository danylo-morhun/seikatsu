import { relations } from "drizzle-orm";
import {
	date,
	index,
	pgEnum,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";
import { workspaces } from "./kuroji";

/**
 * 志 Goals: what the apps are for ("Tatry in February", "A new job"). A goal gathers whole
 * containers from the apps (a fund, a project, a habit, a list…) and reads its progress from
 * them; it holds no progress of its own.
 */
export const goals = pgTable(
	"goals",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		workspaceId: uuid("workspace_id")
			.notNull()
			.references(() => workspaces.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		note: text("note"),
		/** When it should be reached; none for an open-ended one. */
		targetDate: date("target_date"),
		/** Fractional index: the user's order. */
		position: varchar("position", { length: 255 }).notNull(),
		/** Reached or dropped: off the page, kept for the record. */
		archivedAt: timestamp("archived_at", { withTimezone: true }),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [index("goals_workspace_id_idx").on(t.workspaceId)],
);

/** What a goal can gather, one whole container per link. */
export const goalLinkKindEnum = pgEnum("goal_link_kind", [
	"fund", // a Kuroji fund (money put aside for a dated goal), with its own target
	"project", // a Seiryu project
	"habit", // a Keizoku habit
	"list", // a Hoshii list
	"shelf", // a Tsundoku shelf
	"jobs", // the Kyuu search as a whole (no ref)
]);

export const goalLinks = pgTable(
	"goal_links",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		goalId: uuid("goal_id")
			.notNull()
			.references(() => goals.id, { onDelete: "cascade" }),
		kind: goalLinkKindEnum("kind").notNull(),
		/** The container's id in its app; null for "jobs". A container that's deleted just stops
		 * showing (no FK across apps). */
		refId: uuid("ref_id"),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [
		index("goal_links_goal_id_idx").on(t.goalId),
		uniqueIndex("goal_links_goal_kind_ref_uq").on(t.goalId, t.kind, t.refId),
	],
);

export const goalsRelations = relations(goals, ({ one, many }) => ({
	workspace: one(workspaces, { fields: [goals.workspaceId], references: [workspaces.id] }),
	links: many(goalLinks),
}));

export const goalLinksRelations = relations(goalLinks, ({ one }) => ({
	goal: one(goals, { fields: [goalLinks.goalId], references: [goals.id] }),
}));

export type Goal = typeof goals.$inferSelect;
export type GoalLink = typeof goalLinks.$inferSelect;
export type GoalLinkKind = (typeof goalLinkKindEnum.enumValues)[number];
