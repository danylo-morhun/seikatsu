import {
	boolean,
	index,
	integer,
	jsonb,
	pgEnum,
	pgTable,
	text,
	timestamp,
	uuid,
} from "drizzle-orm/pg-core";
import { workspaces } from "./kuroji";

// Claude's access to seikatsu over MCP (apps/web/src/features/mcp). seikatsu is its own
// OAuth 2.1 authorization server: clients register themselves (RFC 7591), the user consents
// on /oauth/authorize, and every secret is stored as a sha256 hash — never the value.

/** A client that registered itself: claude.ai, Claude Code, MCP Inspector. */
export const mcpClients = pgTable("mcp_clients", {
	id: text("id").primaryKey(),
	name: text("name").notNull(),
	redirectUris: jsonb("redirect_uris").$type<string[]>().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** A one-time authorization code, waiting to be exchanged at the token endpoint. */
export const mcpCodes = pgTable("mcp_codes", {
	codeHash: text("code_hash").primaryKey(),
	clientId: text("client_id")
		.notNull()
		.references(() => mcpClients.id, { onDelete: "cascade" }),
	workspaceId: uuid("workspace_id")
		.notNull()
		.references(() => workspaces.id, { onDelete: "cascade" }),
	scopes: jsonb("scopes").$type<string[]>().notNull(),
	codeChallenge: text("code_challenge").notNull(),
	redirectUri: text("redirect_uri").notNull(),
	expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
	usedAt: timestamp("used_at", { withTimezone: true }),
});

/** One "Allow" (or one personal token): what a client may do, until revoked. */
export const mcpGrants = pgTable(
	"mcp_grants",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		workspaceId: uuid("workspace_id")
			.notNull()
			.references(() => workspaces.id, { onDelete: "cascade" }),
		/** Null for a personal token made in Settings. */
		clientId: text("client_id").references(() => mcpClients.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		scopes: jsonb("scopes").$type<string[]>().notNull(),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
		revokedAt: timestamp("revoked_at", { withTimezone: true }),
	},
	(t) => [index("mcp_grants_workspace_idx").on(t.workspaceId)],
);

export const mcpTokenKindEnum = pgEnum("mcp_token_kind", ["access", "refresh"]);

export const mcpTokens = pgTable(
	"mcp_tokens",
	{
		tokenHash: text("token_hash").primaryKey(),
		grantId: uuid("grant_id")
			.notNull()
			.references(() => mcpGrants.id, { onDelete: "cascade" }),
		kind: mcpTokenKindEnum("kind").notNull(),
		/** Null = a personal token: lives until its grant is revoked. */
		expiresAt: timestamp("expires_at", { withTimezone: true }),
		/** A refresh token already traded in: using it again revokes the whole grant. */
		rotatedAt: timestamp("rotated_at", { withTimezone: true }),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [index("mcp_tokens_grant_idx").on(t.grantId)],
);

/** Every tool call: what Claude did (writes keep their arguments), for Settings → Claude. */
export const mcpCalls = pgTable(
	"mcp_calls",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		grantId: uuid("grant_id")
			.notNull()
			.references(() => mcpGrants.id, { onDelete: "cascade" }),
		tool: text("tool").notNull(),
		write: boolean("write").notNull(),
		ok: boolean("ok").notNull(),
		ms: integer("ms").notNull(),
		args: jsonb("args"),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [index("mcp_calls_grant_created_idx").on(t.grantId, t.createdAt)],
);
