import { index, numeric, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { transactions, workspaces } from "./kuroji";

/** The key an iPhone Shortcut sends with each Apple Pay payment. Shown once, stored hashed. */
export const kurojiCaptureKeys = pgTable("kuroji_capture_keys", {
	workspaceId: uuid("workspace_id")
		.primaryKey()
		.references(() => workspaces.id, { onDelete: "cascade" }),
	keyHash: text("key_hash").notNull().unique(),
	createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
});

// pending   → waiting in the inbox for the user to add it
// added     → the user saved it as a transaction (`transactionId`)
// matched   → a bank import booked it first (`transactionId` is the imported one)
// dismissed → the user threw it away
export const kurojiCaptureStateEnum = pgEnum("kuroji_capture_state", [
	"pending",
	"added",
	"matched",
	"dismissed",
]);

/** One Apple Pay payment as the Wallet reported it, before it is a transaction. */
export const kurojiCaptures = pgTable(
	"kuroji_captures",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		workspaceId: uuid("workspace_id")
			.notNull()
			.references(() => workspaces.id, { onDelete: "cascade" }),
		amount: numeric("amount", { precision: 19, scale: 4 }).notNull(),
		currency: text("currency").notNull(),
		merchant: text("merchant").notNull(),
		card: text("card"),
		paidAt: timestamp("paid_at", { withTimezone: true }).notNull().defaultNow(),
		state: kurojiCaptureStateEnum("state").notNull().default("pending"),
		transactionId: uuid("transaction_id").references(() => transactions.id, {
			onDelete: "set null",
		}),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [index("kuroji_captures_workspace_state_idx").on(t.workspaceId, t.state)],
);

export type KurojiCapture = typeof kurojiCaptures.$inferSelect;
