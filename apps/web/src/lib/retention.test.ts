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
const DAY_MS = 24 * 60 * 60 * 1000;
const daysAgo = (n: number) => new Date(NOW.getTime() - n * DAY_MS);

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
			{ workspaceId: ws.id, key: "aisha:item:1:overdue::", sentAt: daysAgo(400) },
		]);

		const pruned = await pruneOldRows(NOW);
		expect(pruned.outboxReceipts).toBe(1);
		expect(pruned.notificationLog).toBe(1);

		const receipts = await testDb.select().from(schema.outboxReceipts);
		const keys = await testDb.select().from(schema.notificationLog);
		expect(receipts.map((r) => r.name)).toEqual(["new"]);
		expect(keys.map((k) => k.key).sort()).toEqual(["aisha:item:1:overdue::", "new"]);
	});

	it("drops expired mcp codes/tokens, old calls, dead grants and idle clients", async () => {
		const [ws] = await testDb
			.insert(schema.workspaces)
			.values({ userId: "user-mcp", name: "Test", baseCurrency: "USD" })
			.returning();
		const client = (id: string, createdAt: Date) => ({
			id,
			name: id,
			redirectUris: ["https://x.test/cb"],
			createdAt,
		});
		await testDb
			.insert(schema.mcpClients)
			.values([
				client("live", daysAgo(60)),
				client("idle", daysAgo(31)),
				client("fresh", daysAgo(1)),
				client("pending", daysAgo(31)),
				client("orphaned", daysAgo(60)),
			]);
		const code = (hash: string, clientId: string, expiresAt: Date) => ({
			codeHash: hash,
			clientId,
			workspaceId: ws.id,
			scopes: ["read"],
			codeChallenge: "c",
			redirectUri: "https://x.test/cb",
			expiresAt,
		});
		await testDb
			.insert(schema.mcpCodes)
			.values([
				code("code-old", "idle", daysAgo(1)),
				code("code-live", "pending", new Date(NOW.getTime() + 60_000)),
			]);
		const grant = (name: string, extra: Partial<typeof schema.mcpGrants.$inferInsert>) => ({
			workspaceId: ws.id,
			name,
			scopes: ["read"],
			...extra,
		});
		const grants = await testDb
			.insert(schema.mcpGrants)
			.values([
				grant("live", { clientId: "live", createdAt: daysAgo(40) }),
				grant("revoked-old", { clientId: "live", revokedAt: daysAgo(31) }),
				grant("revoked-new", { clientId: "live", revokedAt: daysAgo(5), createdAt: daysAgo(40) }),
				grant("dead", { clientId: "orphaned", createdAt: daysAgo(40) }),
				grant("issuing", { clientId: "live", createdAt: NOW }),
				grant("personal", { clientId: null, createdAt: daysAgo(40) }),
			])
			.returning();
		const id = (name: string) => grants.find((g) => g.name === name)?.id as string;
		const token = (hash: string, grantId: string, expiresAt: Date | null) => ({
			tokenHash: hash,
			grantId,
			kind: "access" as const,
			expiresAt,
		});
		await testDb
			.insert(schema.mcpTokens)
			.values([
				token("t-live", id("live"), new Date(NOW.getTime() + DAY_MS)),
				token("t-expired", id("live"), daysAgo(1)),
				token("t-dead", id("dead"), daysAgo(2)),
				token("t-revoked", id("revoked-new"), new Date(NOW.getTime() + DAY_MS)),
			]);
		await testDb.insert(schema.mcpCalls).values([
			{ grantId: id("live"), tool: "old", write: false, ok: true, ms: 1, createdAt: daysAgo(91) },
			{ grantId: id("live"), tool: "new", write: false, ok: true, ms: 1, createdAt: daysAgo(89) },
		]);

		const { mcp } = await pruneOldRows(NOW);
		expect(mcp).toEqual({ codes: 1, tokens: 2, calls: 1, grants: 2, clients: 2 });

		const left = async <T>(rows: Promise<T[]>, pick: (r: T) => string) =>
			(await rows).map(pick).sort();
		expect(await left(testDb.select().from(schema.mcpGrants), (g) => g.name)).toEqual([
			"issuing",
			"live",
			"personal",
			"revoked-new",
		]);
		expect(await left(testDb.select().from(schema.mcpTokens), (t) => t.tokenHash)).toEqual([
			"t-live",
			"t-revoked",
		]);
		expect(await left(testDb.select().from(schema.mcpClients), (c) => c.id)).toEqual([
			"fresh",
			"live",
			"pending",
		]);
		expect(await left(testDb.select().from(schema.mcpCalls), (c) => c.tool)).toEqual(["new"]);
	});
});
