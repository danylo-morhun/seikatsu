import * as schema from "@seikatsu/db/schema";
import { createTestDb } from "@seikatsu/db/test-utils";
import * as ops from "drizzle-orm";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

let testDb: Awaited<ReturnType<typeof createTestDb>>;
let workspaceId = "";
let today = "2026-11-06";

vi.mock("@/lib/session", () => ({
	isUuid: (v: string) => /^[0-9a-f-]{36}$/i.test(v),
	requireWorkspace: vi.fn(async () => ({ id: workspaceId })),
}));
vi.mock("@/lib/timezone", () => ({
	getUserToday: vi.fn(async () => today),
	getUserTimeZone: vi.fn(async () => "Europe/Warsaw"),
}));
vi.mock("@/lib/revalidate", () => ({ revalidateShell: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("react", async (orig) => ({ ...(await orig<object>()), cache: <T>(fn: T) => fn }));

// Real Postgres (PGlite, real migrations) in place of the network DB.
vi.mock("@seikatsu/db", async () => ({
	...schema,
	...ops,
	get db() {
		return testDb;
	},
}));

const { moveCard } = await import("./cards");
const C = schema.seiryuCards;

async function seed(card: Partial<typeof C.$inferInsert> = {}) {
	const [workspace] = await testDb
		.insert(schema.workspaces)
		.values({ userId: "user-1", name: "W", baseCurrency: "USD" })
		.returning();
	workspaceId = workspace.id;
	const [project] = await testDb
		.insert(schema.seiryuProjects)
		.values({ workspaceId, name: "Home", position: "a0" })
		.returning();
	const [todo, done] = await testDb
		.insert(schema.seiryuColumns)
		.values([
			{ projectId: project.id, name: "To do", position: "a0" },
			{ projectId: project.id, name: "Done", position: "a1", isDone: true },
		])
		.returning();
	const [label] = await testDb
		.insert(schema.seiryuLabels)
		.values({ projectId: project.id, name: "Money", color: "#000000" })
		.returning();
	const [row] = await testDb
		.insert(C)
		.values({
			projectId: project.id,
			columnId: todo.id,
			title: "Accounting",
			position: "a0",
			dueDate: "2026-11-06",
			dueTime: "10:00",
			remindMinutes: 0,
			repeatEvery: 1,
			repeatUnit: "month",
			...card,
		})
		.returning();
	await testDb.insert(schema.seiryuChecklistItems).values({
		cardId: row.id,
		title: "Upload invoices",
		isCompleted: true,
		position: "a0",
	});
	await testDb.insert(schema.seiryuCardLabels).values({ cardId: row.id, labelId: label.id });
	return { card: row, todo, done };
}

const open = () => testDb.select().from(C).where(ops.isNull(C.doneOn));

describe("repeating cards", () => {
	beforeAll(async () => {
		testDb = await createTestDb();
	}, 30_000);

	afterEach(async () => {
		await testDb.delete(schema.workspaces);
		today = "2026-11-06";
	});

	it("finishing one makes the next, once, with its labels and a fresh checklist", async () => {
		const { card, todo, done } = await seed();
		await moveCard({ cardId: card.id, newColumnId: done.id });
		// Sent again (offline replay): still one.
		await moveCard({ cardId: card.id, newColumnId: done.id });

		const [next, ...more] = await open();
		expect(more).toHaveLength(0);
		expect(next).toMatchObject({
			title: "Accounting",
			columnId: todo.id,
			dueDate: "2026-12-06",
			dueTime: "10:00:00",
			repeatUnit: "month",
		});
		// 10:00 in Warsaw (winter) is 09:00 UTC.
		expect(next?.remindAt?.toISOString()).toBe("2026-12-06T09:00:00.000Z");
		const items = await testDb
			.select()
			.from(schema.seiryuChecklistItems)
			.where(ops.eq(schema.seiryuChecklistItems.cardId, next?.id ?? ""));
		expect(items.map((i) => [i.title, i.isCompleted])).toEqual([["Upload invoices", false]]);
		const labels = await testDb
			.select()
			.from(schema.seiryuCardLabels)
			.where(ops.eq(schema.seiryuCardLabels.cardId, next?.id ?? ""));
		expect(labels).toHaveLength(1);
	});

	it("reopening takes the next one back", async () => {
		const { card, todo, done } = await seed();
		await moveCard({ cardId: card.id, newColumnId: done.id });
		await moveCard({ cardId: card.id, newColumnId: todo.id });
		const rows = await open();
		expect(rows.map((r) => r.id)).toEqual([card.id]);
		expect(rows[0]?.nextCardId).toBeNull();
	});

	it("counts from the day it's done when asked", async () => {
		const { card, done } = await seed({ repeatEvery: 2, repeatUnit: "week", repeatFromDone: true });
		today = "2026-11-10";
		await moveCard({ cardId: card.id, newColumnId: done.id });
		expect((await open())[0]?.dueDate).toBe("2026-11-24");
	});

	it("a card that doesn't repeat just finishes", async () => {
		const { card, done } = await seed({ repeatEvery: null, repeatUnit: null });
		await moveCard({ cardId: card.id, newColumnId: done.id });
		expect(await open()).toHaveLength(0);
	});
});
