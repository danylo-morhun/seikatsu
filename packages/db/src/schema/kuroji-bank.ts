import { relations } from "drizzle-orm";
import {
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
import { accounts, workspaces } from "./kuroji";

// CREATED  → authorization started, awaiting end-user bank consent
// LINKED   → session established, at least one account available, syncing
// EXPIRED  → PSD2 access window lapsed, needs reconnect
// ERROR    → last sync failed irrecoverably
export const bankConnectionStatusEnum = pgEnum("bank_connection_status", [
	"CREATED",
	"LINKED",
	"EXPIRED",
	"ERROR",
]);

// One Enable Banking consent to one ASPSP (bank).
export const bankConnections = pgTable(
	"bank_connections",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		workspaceId: uuid("workspace_id")
			.notNull()
			.references(() => workspaces.id, { onDelete: "cascade" }),
		// Enable Banking ASPSP is identified by (name, country).
		aspspName: text("aspsp_name").notNull(),
		aspspCountry: text("aspsp_country").notNull(),
		displayName: text("display_name").notNull(),
		// Correlation token passed through the bank redirect (returned as `state`).
		authState: text("auth_state").notNull(),
		// Enable Banking session id, set after the redirect code is exchanged.
		sessionId: text("session_id"),
		status: bankConnectionStatusEnum("status").notNull().default("CREATED"),
		accessExpiresAt: timestamp("access_expires_at", { withTimezone: true }),
		lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
		lastError: text("last_error"),
		// Floor for imports: only transactions booked on/after this date are pulled.
		// Null = full available history (up to the bank's max, typically ~730 days).
		importFromDate: date("import_from_date"),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [
		index("bank_connections_workspace_id_idx").on(t.workspaceId),
		uniqueIndex("bank_connections_auth_state_idx").on(t.authState),
	],
);

// One bank account exposed by a session, optionally mapped to a Kuroji account.
export const bankAccounts = pgTable(
	"bank_accounts",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		connectionId: uuid("connection_id")
			.notNull()
			.references(() => bankConnections.id, { onDelete: "cascade" }),
		// Enable Banking account uid.
		accountUid: text("account_uid").notNull(),
		iban: text("iban"),
		name: text("name").notNull(),
		currency: text("currency"),
		// Kuroji account this posts into. Null until linked.
		accountId: uuid("account_id").references(() => accounts.id, { onDelete: "set null" }),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [
		index("bank_accounts_connection_id_idx").on(t.connectionId),
		uniqueIndex("bank_accounts_account_uid_idx").on(t.accountUid),
	],
);

// Keyword → counterpart category account. First match (lowest priority value) wins.
export const bankRules = pgTable(
	"bank_rules",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		workspaceId: uuid("workspace_id")
			.notNull()
			.references(() => workspaces.id, { onDelete: "cascade" }),
		matchText: text("match_text").notNull(),
		accountId: uuid("account_id")
			.notNull()
			.references(() => accounts.id, { onDelete: "cascade" }),
		priority: integer("priority").notNull().default(0),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [index("bank_rules_workspace_id_idx").on(t.workspaceId)],
);

// ─── Relations ───────────────────────────────────────────────────────────────

export const bankConnectionsRelations = relations(bankConnections, ({ one, many }) => ({
	workspace: one(workspaces, {
		fields: [bankConnections.workspaceId],
		references: [workspaces.id],
	}),
	bankAccounts: many(bankAccounts),
}));

export const bankAccountsRelations = relations(bankAccounts, ({ one }) => ({
	connection: one(bankConnections, {
		fields: [bankAccounts.connectionId],
		references: [bankConnections.id],
	}),
	account: one(accounts, {
		fields: [bankAccounts.accountId],
		references: [accounts.id],
	}),
}));

export const bankRulesRelations = relations(bankRules, ({ one }) => ({
	workspace: one(workspaces, {
		fields: [bankRules.workspaceId],
		references: [workspaces.id],
	}),
	account: one(accounts, {
		fields: [bankRules.accountId],
		references: [accounts.id],
	}),
}));
