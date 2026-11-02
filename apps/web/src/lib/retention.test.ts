import * as schema from "@seikatsu/db/schema";
import { createTestDb } from "@seikatsu/db/test-utils";
import * as ops from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";

let testDb: Awaited<ReturnType<typeof createTestDb>>;

vi.mock("@seikatsu/db", async () => ({
	...schema,
	...ops,
	get db() {
		return testDb;
	},
}));

const { pruneOldRows } = await import("./retention");

const NOW = new Date("2026-11-02T12:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000);

describe("pruneOldRows", () => {
	beforeAll(async () => {
		testDb = await createTestDb();
	});

	it("drops receipts after 30 days and notification keys after 90", async () => {
		const [ws] = await testDb
			.insert(schema.workspaces)
			.values({ userId: "user-1", name: "Test", baseCurrency: "USD" })
			.returning();
		await testDb.insert(schema.outboxReceipts).values([
			{ opId: crypto.randomUUID(), workspaceId: ws.id, name: "old", createdAt: daysAgo(31) },
			{ opId: crypto.randomUUID(), workspaceId: ws.id, name: "new", createdAt: daysAgo(29) },
		]);
		await testDb.insert(schema.notificationLog).values([
			{ workspaceId: ws.id, key: "old", sentAt: daysAgo(91) },
			{ workspaceId: ws.id, key: "new", sentAt: daysAgo(89) },
		]);

		expect(await pruneOldRows(NOW)).toEqual({ outboxReceipts: 1, notificationLog: 1 });

		const receipts = await testDb.select().from(schema.outboxReceipts);
		const keys = await testDb.select().from(schema.notificationLog);
		expect(receipts.map((r) => r.name)).toEqual(["new"]);
		expect(keys.map((k) => k.key)).toEqual(["new"]);
	});
});
