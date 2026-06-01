import { relations } from "drizzle-orm";
import {
	boolean,
	date,
	index,
	pgEnum,
	pgTable,
	primaryKey,
	text,
	timestamp,
	uniqueIndex,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";
import { workspaces } from "./kuroji";

export const seiryuCardPriorityEnum = pgEnum("seiryu_card_priority", [
	"low",
	"medium",
	"high",
	"urgent",
]);

export const seiryuProjects = pgTable(
	"seiryu_projects",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		workspaceId: uuid("workspace_id")
			.notNull()
			.references(() => workspaces.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		description: text("description"),
		color: text("color"),
		position: varchar("position", { length: 255 }).notNull(),
		archivedAt: timestamp("archived_at", { withTimezone: true }),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [index("seiryu_projects_workspace_id_idx").on(t.workspaceId)],
);

export const seiryuColumns = pgTable(
	"seiryu_columns",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		projectId: uuid("project_id")
			.notNull()
			.references(() => seiryuProjects.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		color: text("color"),
		position: varchar("position", { length: 255 }).notNull(),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [index("seiryu_columns_project_id_idx").on(t.projectId)],
);

export const seiryuCards = pgTable(
	"seiryu_cards",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		columnId: uuid("column_id")
			.notNull()
			.references(() => seiryuColumns.id, { onDelete: "cascade" }),
		projectId: uuid("project_id")
			.notNull()
			.references(() => seiryuProjects.id, { onDelete: "cascade" }),
		title: text("title").notNull(),
		description: text("description"),
		priority: seiryuCardPriorityEnum("priority"),
		dueDate: date("due_date"),
		position: varchar("position", { length: 255 }).notNull(),
		archivedAt: timestamp("archived_at", { withTimezone: true }),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [
		index("seiryu_cards_project_id_idx").on(t.projectId),
		index("seiryu_cards_column_id_idx").on(t.columnId),
	],
);

export const seiryuChecklistItems = pgTable(
	"seiryu_checklist_items",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		cardId: uuid("card_id")
			.notNull()
			.references(() => seiryuCards.id, { onDelete: "cascade" }),
		title: text("title").notNull(),
		isCompleted: boolean("is_completed").notNull().default(false),
		position: varchar("position", { length: 255 }).notNull(),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [index("seiryu_checklist_items_card_id_idx").on(t.cardId)],
);

export const seiryuLabels = pgTable(
	"seiryu_labels",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		projectId: uuid("project_id")
			.notNull()
			.references(() => seiryuProjects.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		color: text("color").notNull(),
	},
	(t) => [
		index("seiryu_labels_project_id_idx").on(t.projectId),
		uniqueIndex("seiryu_labels_project_name_idx").on(t.projectId, t.name),
	],
);

export const seiryuCardLabels = pgTable(
	"seiryu_card_labels",
	{
		cardId: uuid("card_id")
			.notNull()
			.references(() => seiryuCards.id, { onDelete: "cascade" }),
		labelId: uuid("label_id")
			.notNull()
			.references(() => seiryuLabels.id, { onDelete: "cascade" }),
	},
	(t) => [
		primaryKey({ columns: [t.cardId, t.labelId] }),
		index("seiryu_card_labels_card_id_idx").on(t.cardId),
		index("seiryu_card_labels_label_id_idx").on(t.labelId),
	],
);

// ─── Relations ───────────────────────────────────────────────────────────────

export const seiryuProjectsRelations = relations(seiryuProjects, ({ one, many }) => ({
	workspace: one(workspaces, {
		fields: [seiryuProjects.workspaceId],
		references: [workspaces.id],
	}),
	columns: many(seiryuColumns),
	cards: many(seiryuCards),
	labels: many(seiryuLabels),
}));

export const seiryuColumnsRelations = relations(seiryuColumns, ({ one, many }) => ({
	project: one(seiryuProjects, {
		fields: [seiryuColumns.projectId],
		references: [seiryuProjects.id],
	}),
	cards: many(seiryuCards),
}));

export const seiryuCardsRelations = relations(seiryuCards, ({ one, many }) => ({
	column: one(seiryuColumns, {
		fields: [seiryuCards.columnId],
		references: [seiryuColumns.id],
	}),
	project: one(seiryuProjects, {
		fields: [seiryuCards.projectId],
		references: [seiryuProjects.id],
	}),
	checklistItems: many(seiryuChecklistItems),
	cardLabels: many(seiryuCardLabels),
}));

export const seiryuChecklistItemsRelations = relations(seiryuChecklistItems, ({ one }) => ({
	card: one(seiryuCards, {
		fields: [seiryuChecklistItems.cardId],
		references: [seiryuCards.id],
	}),
}));

export const seiryuLabelsRelations = relations(seiryuLabels, ({ one, many }) => ({
	project: one(seiryuProjects, {
		fields: [seiryuLabels.projectId],
		references: [seiryuProjects.id],
	}),
	cardLabels: many(seiryuCardLabels),
}));

export const seiryuCardLabelsRelations = relations(seiryuCardLabels, ({ one }) => ({
	card: one(seiryuCards, {
		fields: [seiryuCardLabels.cardId],
		references: [seiryuCards.id],
	}),
	label: one(seiryuLabels, {
		fields: [seiryuCardLabels.labelId],
		references: [seiryuLabels.id],
	}),
}));
