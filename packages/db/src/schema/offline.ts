import { jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { workspaces } from "./kuroji";

/**
 * One row per offline operation replayed through /api/outbox, keyed by the id the browser
 * gave it. A retried replay (lost response, two tabs) gets the stored result instead of
 * running twice. `result` is null while the first attempt is still running.
 */
export const outboxReceipts = pgTable("outbox_receipts", {
	opId: uuid("op_id").primaryKey(),
	workspaceId: uuid("workspace_id")
		.notNull()
		.references(() => workspaces.id, { onDelete: "cascade" }),
	name: text("name").notNull(),
	result: jsonb("result"),
	createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
