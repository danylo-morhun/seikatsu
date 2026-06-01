import { relations } from "drizzle-orm";
import {
	boolean,
	date,
	index,
	numeric,
	pgEnum,
	pgTable,
	primaryKey,
	text,
	timestamp,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { authUsers } from "./auth";

export const frequencyEnum = pgEnum("frequency", ["daily", "weekly", "monthly", "yearly"]);

export const accountTypeEnum = pgEnum("account_type", ["ASSET", "LIABILITY", "INCOME", "EXPENSE"]);

export const workspaces = pgTable(
	"workspaces",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		userId: text("user_id").notNull(),
		name: text("name").notNull(),
		baseCurrency: text("base_currency").notNull().default("USD"),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [uniqueIndex("workspaces_user_id_idx").on(t.userId)],
);

export const accounts = pgTable(
	"accounts",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		workspaceId: uuid("workspace_id")
			.notNull()
			.references(() => workspaces.id, { onDelete: "cascade" }),
		parentId: uuid("parent_id").references((): AnyPgColumn => accounts.id, {
			onDelete: "set null",
		}),
		name: text("name").notNull(),
		type: accountTypeEnum("type").notNull(),
		currency: text("currency").notNull(),
		budget: numeric("budget", { precision: 19, scale: 4 }),
		archivedAt: timestamp("archived_at", { withTimezone: true }),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [index("accounts_workspace_id_idx").on(t.workspaceId)],
);

export const transactions = pgTable(
	"transactions",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		workspaceId: uuid("workspace_id")
			.notNull()
			.references(() => workspaces.id, { onDelete: "cascade" }),
		date: date("date").notNull(),
		description: text("description"),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [index("transactions_workspace_id_idx").on(t.workspaceId)],
);

export const transactionEntries = pgTable(
	"transaction_entries",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		transactionId: uuid("transaction_id")
			.notNull()
			.references(() => transactions.id, { onDelete: "cascade" }),
		accountId: uuid("account_id")
			.notNull()
			.references(() => accounts.id),
		amount: numeric("amount", { precision: 19, scale: 4 }).notNull(),
		currency: text("currency").notNull(),
		baseAmount: numeric("base_amount", { precision: 19, scale: 4 }).notNull(),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [
		index("transaction_entries_transaction_id_idx").on(t.transactionId),
		index("transaction_entries_account_id_idx").on(t.accountId),
	],
);

export const exchangeRates = pgTable(
	"exchange_rates",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		date: date("date").notNull(),
		fromCurrency: text("from_currency").notNull(),
		toCurrency: text("to_currency").notNull(),
		rate: numeric("rate", { precision: 19, scale: 8 }).notNull(),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [uniqueIndex("exchange_rates_date_pair_idx").on(t.date, t.fromCurrency, t.toCurrency)],
);

// ─── Relations ───────────────────────────────────────────────────────────────

export const authUsersRelations = relations(authUsers, ({ many }) => ({
	workspaces: many(workspaces),
}));

export const workspacesRelations = relations(workspaces, ({ one, many }) => ({
	user: one(authUsers, {
		fields: [workspaces.userId],
		references: [authUsers.id],
	}),
	accounts: many(accounts),
	transactions: many(transactions),
}));

export const accountsRelations = relations(accounts, ({ one, many }) => ({
	workspace: one(workspaces, {
		fields: [accounts.workspaceId],
		references: [workspaces.id],
	}),
	parent: one(accounts, {
		fields: [accounts.parentId],
		references: [accounts.id],
		relationName: "account_children",
	}),
	children: many(accounts, { relationName: "account_children" }),
	transactionEntries: many(transactionEntries),
	recurringFrom: many(recurringTransactions, { relationName: "recurring_from" }),
	recurringTo: many(recurringTransactions, { relationName: "recurring_to" }),
}));

export const transactionsRelations = relations(transactions, ({ one, many }) => ({
	workspace: one(workspaces, {
		fields: [transactions.workspaceId],
		references: [workspaces.id],
	}),
	entries: many(transactionEntries),
	transactionTags: many(transactionTags),
}));

export const transactionEntriesRelations = relations(transactionEntries, ({ one }) => ({
	transaction: one(transactions, {
		fields: [transactionEntries.transactionId],
		references: [transactions.id],
	}),
	account: one(accounts, {
		fields: [transactionEntries.accountId],
		references: [accounts.id],
	}),
}));

export const tags = pgTable(
	"tags",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		workspaceId: uuid("workspace_id")
			.notNull()
			.references(() => workspaces.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		color: text("color"),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [
		index("tags_workspace_id_idx").on(t.workspaceId),
		uniqueIndex("tags_workspace_name_idx").on(t.workspaceId, t.name),
	],
);

export const transactionTags = pgTable(
	"transaction_tags",
	{
		transactionId: uuid("transaction_id")
			.notNull()
			.references(() => transactions.id, { onDelete: "cascade" }),
		tagId: uuid("tag_id")
			.notNull()
			.references(() => tags.id, { onDelete: "cascade" }),
	},
	(t) => [primaryKey({ columns: [t.transactionId, t.tagId] })],
);

export const recurringTransactions = pgTable(
	"recurring_transactions",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		workspaceId: uuid("workspace_id")
			.notNull()
			.references(() => workspaces.id, { onDelete: "cascade" }),
		fromAccountId: uuid("from_account_id")
			.notNull()
			.references(() => accounts.id),
		toAccountId: uuid("to_account_id")
			.notNull()
			.references(() => accounts.id),
		amount: numeric("amount", { precision: 19, scale: 4 }).notNull(),
		currency: text("currency").notNull(),
		description: text("description"),
		frequency: frequencyEnum("frequency").notNull(),
		nextDate: date("next_date").notNull(),
		endDate: date("end_date"),
		isActive: boolean("is_active").notNull().default(true),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [index("recurring_transactions_workspace_id_idx").on(t.workspaceId)],
);

export const recurringTransactionsRelations = relations(recurringTransactions, ({ one }) => ({
	workspace: one(workspaces, {
		fields: [recurringTransactions.workspaceId],
		references: [workspaces.id],
	}),
	fromAccount: one(accounts, {
		fields: [recurringTransactions.fromAccountId],
		references: [accounts.id],
		relationName: "recurring_from",
	}),
	toAccount: one(accounts, {
		fields: [recurringTransactions.toAccountId],
		references: [accounts.id],
		relationName: "recurring_to",
	}),
}));

export const tagsRelations = relations(tags, ({ one, many }) => ({
	workspace: one(workspaces, { fields: [tags.workspaceId], references: [workspaces.id] }),
	transactionTags: many(transactionTags),
}));

export const transactionTagsRelations = relations(transactionTags, ({ one }) => ({
	transaction: one(transactions, {
		fields: [transactionTags.transactionId],
		references: [transactions.id],
	}),
	tag: one(tags, { fields: [transactionTags.tagId], references: [tags.id] }),
}));
