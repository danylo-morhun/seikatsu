import * as schema from "@seikatsu/db/schema";
import { createTestDb } from "@seikatsu/db/test-utils";
import * as ops from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";

let testDb: Awaited<ReturnType<typeof createTestDb>>;
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@seikatsu/db", async () => ({
	...schema,
	...ops,
	get db() {
		return testDb;
	},
}));

const { tickReadingHabits } = await import("./from-reading");

beforeAll(async () => {
	testDb = await createTestDb();
}, 30_000);

describe("tickReadingHabits", () => {
	it("checks in only the habits marked to follow reading, and keeps a day's note", async () => {
		const [ws] = await testDb
			.insert(schema.workspaces)
			.values({ userId: "user-1", name: "Test", baseCurrency: "PLN" })
			.returning();
		const [read, run] = await testDb
			.insert(schema.keizokuHabits)
			.values([
				{
					workspaceId: ws.id,
					name: "Read",
					emoji: "📖",
					frequencyType: "daily",
					fromReading: true,
				},
				{ workspaceId: ws.id, name: "Run", emoji: "🏃", frequencyType: "daily" },
			])
			.returning();
		await testDb
			.insert(schema.keizokuHabitLogs)
			.values({ habitId: read.id, date: "2026-11-03", note: "Kept" });

		await tickReadingHabits(ws.id, "2026-11-03");
		await tickReadingHabits(ws.id, "2026-11-04");

		const logs = await testDb.select().from(schema.keizokuHabitLogs);
		expect(logs.filter((l) => l.habitId === run.id)).toEqual([]);
		expect(
			logs
				.filter((l) => l.habitId === read.id)
				.map((l) => [l.date, l.note])
				.sort(),
		).toEqual([
			["2026-11-03", "Kept"],
			["2026-11-04", null],
		]);
	});
});
