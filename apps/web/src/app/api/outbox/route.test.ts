import * as schema from "@seikatsu/db/schema";
import { createTestDb } from "@seikatsu/db/test-utils";
import * as ops from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

let testDb: Awaited<ReturnType<typeof createTestDb>>;
let workspaceId: string;

vi.mock("@seikatsu/db", async () => ({
	...schema,
	...ops,
	get db() {
		return testDb;
	},
}));
vi.mock("@/lib/session", () => ({
	getCurrentWorkspace: vi.fn(async () => (workspaceId ? { id: workspaceId } : null)),
}));
const replay = vi.fn(async (..._args: unknown[]) => ({ success: true }) as const);
vi.mock("@/features/pwa/lib/registry", () => ({ replay: (...a: unknown[]) => replay(...a) }));

const { POST } = await import("./route");

const OP = "6f1c4b8e-3d2a-4f5b-9c7d-1e2f3a4b5c6d";
const post = (body: unknown) =>
	POST(
		new Request("http://test/api/outbox", { method: "POST", body: JSON.stringify(body) }) as never,
	);

describe("POST /api/outbox", () => {
	beforeAll(async () => {
		testDb = await createTestDb();
		const [ws] = await testDb
			.insert(schema.workspaces)
			.values({ userId: "user-1", name: "Test", baseCurrency: "USD" })
			.returning();
		workspaceId = ws.id;
	});
	beforeEach(async () => {
		replay.mockClear();
		await testDb.delete(schema.outboxReceipts);
	});

	it("runs an op once; a retry gets the stored result", async () => {
		const body = { opId: OP, name: "keizoku.checkDay", args: { habitId: "x", date: "2026-10-26" } };
		const first = await post(body);
		expect(await first.json()).toEqual({ result: { success: true } });
		const again = await post(body);
		expect(await again.json()).toEqual({ result: { success: true } });
		expect(replay).toHaveBeenCalledTimes(1);
	});

	it("stores a refusal too, so it isn't retried into a different outcome", async () => {
		replay.mockResolvedValueOnce({ error: "Habit not found" } as never);
		const body = { opId: OP, name: "keizoku.checkDay", args: {} };
		expect(await (await post(body)).json()).toEqual({ result: { error: "Habit not found" } });
		expect(await (await post(body)).json()).toEqual({ result: { error: "Habit not found" } });
		expect(replay).toHaveBeenCalledTimes(1);
	});

	it("releases the claim when the replay crashes", async () => {
		replay.mockRejectedValueOnce(new Error("db down"));
		const body = { opId: OP, name: "keizoku.checkDay", args: {} };
		expect((await post(body)).status).toBe(500);
		expect((await post(body)).status).toBe(200);
		expect(replay).toHaveBeenCalledTimes(2);
	});

	it("rejects the signed-out and malformed bodies", async () => {
		expect((await post({ opId: "nope", name: "x" })).status).toBe(400);
		const saved = workspaceId;
		workspaceId = "";
		expect((await post({ opId: OP, name: "keizoku.checkDay", args: {} })).status).toBe(401);
		workspaceId = saved;
	});
});
