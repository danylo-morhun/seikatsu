import { relations } from "drizzle-orm";
import {
	boolean,
	date,
	index,
	integer,
	jsonb,
	numeric,
	pgEnum,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";
import { accounts, transactions, workspaces } from "./kuroji";

/** One option for a want, as its shop's page describes it (read when added). */
export type HoshiiLink = {
	url: string;
	title: string | null;
	imageUrl: string | null;
	price: number | null;
	currency: string | null;
};

/** Cooling → (decide) → plan → bought, or released (let go) from cooling or plan. */
export const hoshiiStateEnum = pgEnum("hoshii_state", ["cooling", "plan", "bought", "released"]);

/** Where wants live (Tech, Clothes…): a grouping and a filter. Money follows the Plan only. */
export const hoshiiLists = pgTable(
	"hoshii_lists",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		workspaceId: uuid("workspace_id")
			.notNull()
			.references(() => workspaces.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		/** Fractional index. */
		position: text("position").notNull(),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [uniqueIndex("hoshii_lists_workspace_name_idx").on(t.workspaceId, t.name)],
);

export const hoshiiItems = pgTable(
	"hoshii_items",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		workspaceId: uuid("workspace_id")
			.notNull()
			.references(() => workspaces.id, { onDelete: "cascade" }),
		listId: uuid("list_id").references(() => hoshiiLists.id, { onDelete: "set null" }),
		title: text("title").notNull(),
		/** Where to buy it: one shop link, or a few options (sizes, colours, shops). */
		links: jsonb("links").$type<HoshiiLink[]>().notNull().default([]),
		/** The want's photo: copied from a link's photo, or uploaded. */
		imageUrl: text("image_url"),
		/** Unknown until filled in; cooling then uses the middle tier. */
		price: numeric("price", { precision: 19, scale: 4 }),
		currency: text("currency").notNull(),
		note: text("note"),
		state: hoshiiStateEnum("state").notNull().default("cooling"),
		/** The user's day it was added, and the day its cooling ends. */
		addedOn: date("added_on").notNull(),
		coolUntil: date("cool_until").notNull(),
		/** "Need it now": went to the Plan without cooling. */
		skippedCooling: boolean("skipped_cooling").notNull().default(false),
		/** Fractional index in the one Plan ranking; set while in the Plan (kept after). */
		planPosition: text("plan_position"),
		keptOn: date("kept_on"),
		boughtOn: date("bought_on"),
		boughtPrice: numeric("bought_price", { precision: 19, scale: 4 }),
		boughtCurrency: text("bought_currency"),
		releasedOn: date("released_on"),
		/** The Kuroji expense the purchase was recorded as, if any. */
		kurojiTransactionId: uuid("kuroji_transaction_id").references(() => transactions.id, {
			onDelete: "set null",
		}),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [
		index("hoshii_items_workspace_id_idx").on(t.workspaceId),
		index("hoshii_items_list_id_idx").on(t.listId),
	],
);

/** One row per workspace: the piggy, purchase defaults and cooling tiers. */
export const hoshiiSettings = pgTable("hoshii_settings", {
	workspaceId: uuid("workspace_id")
		.primaryKey()
		.references(() => workspaces.id, { onDelete: "cascade" }),
	/** The Kuroji ASSET account whose balance funds the Plan, top-down. */
	piggyAccountId: uuid("piggy_account_id").references(() => accounts.id, {
		onDelete: "set null",
	}),
	/** Purchases are paid from here (the piggy unless changed) into this EXPENSE category. */
	walletId: uuid("wallet_id").references(() => accounts.id, { onDelete: "set null" }),
	categoryId: uuid("category_id").references(() => accounts.id, { onDelete: "set null" }),
	/** Cooling by price in the base currency: below `smallBelow`, below `largeFrom`, else. */
	smallBelow: integer("small_below").notNull().default(100),
	largeFrom: integer("large_from").notNull().default(1000),
	smallDays: integer("small_days").notNull().default(7),
	midDays: integer("mid_days").notNull().default(30),
	largeDays: integer("large_days").notNull().default(60),
});

export const hoshiiListsRelations = relations(hoshiiLists, ({ many }) => ({
	items: many(hoshiiItems),
}));

export const hoshiiItemsRelations = relations(hoshiiItems, ({ one }) => ({
	list: one(hoshiiLists, { fields: [hoshiiItems.listId], references: [hoshiiLists.id] }),
}));
