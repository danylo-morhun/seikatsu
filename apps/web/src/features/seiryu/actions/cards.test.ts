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
	dayIn: () => today,
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

const { createCard, moveCard, updateCard } = await import("./cards");
const { archiveFinishedCards } = await import("../lib/auto-archive");
const { catchUpRepeats } = await import("../lib/catch-up");
const { copyGroup } = await import("./groups");
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

describe("sorting and clearing", () => {
	beforeAll(async () => {
		testDb ??= await createTestDb();
	}, 30_000);

	afterEach(async () => {
		await testDb.delete(schema.workspaces);
		today = "2026-11-06";
	});

	it("a new card's title names its group, labels and priority", async () => {
		const { todo } = await seed();
		const [group] = await testDb
			.insert(schema.seiryuGroups)
			.values({ projectId: todo.projectId, name: "Black Week", position: "a0" })
			.returning();
		const made = await createCard({
			projectId: todo.projectId,
			columnId: todo.id,
			title: "Black Week: final price list #money !4",
		});
		if ("error" in made) throw new Error(made.error);
		const [row] = await testDb.select().from(C).where(ops.eq(C.id, made.data.id));
		expect(row).toMatchObject({
			title: "final price list",
			groupId: group?.id,
			priority: "urgent",
		});
		const labels = await testDb
			.select()
			.from(schema.seiryuCardLabels)
			.where(ops.eq(schema.seiryuCardLabels.cardId, made.data.id));
		expect(labels).toHaveLength(1);
	});

	it("a card waits on another, never on itself or in a loop", async () => {
		const { card, todo } = await seed({ repeatEvery: null, repeatUnit: null });
		const [other] = await testDb
			.insert(C)
			.values({ projectId: card.projectId, columnId: todo.id, title: "Xylem sync", position: "a1" })
			.returning();
		const otherId = other?.id ?? "";
		expect(await updateCard({ cardId: card.id, blockedById: card.id })).toHaveProperty("error");
		expect(await updateCard({ cardId: card.id, blockedById: otherId })).toEqual({ success: true });
		expect(await updateCard({ cardId: otherId, blockedById: card.id })).toHaveProperty("error");
		expect(await updateCard({ cardId: card.id, blockedById: null })).toEqual({ success: true });
	});

	it("copies a group as a template, dates moved, checklists fresh", async () => {
		const { card, done } = await seed({ repeatEvery: null, repeatUnit: null });
		const [group] = await testDb
			.insert(schema.seiryuGroups)
			.values({ projectId: card.projectId, name: "BW 2026", position: "a0" })
			.returning();
		await testDb
			.update(C)
			.set({ groupId: group?.id, columnId: done.id, doneOn: "2026-11-06", archivedAt: new Date() })
			.where(ops.eq(C.id, card.id));
		await testDb.insert(C).values({
			projectId: card.projectId,
			columnId: done.id,
			groupId: group?.id,
			title: "Start check",
			position: "a1",
			dueDate: "2026-11-09",
		});

		const copied = await copyGroup({ groupId: group?.id, name: "BW 2027", firstDue: "2027-11-22" });
		if ("error" in copied) throw new Error(copied.error);
		expect(copied.data.cards).toBe(2);
		const rows = await testDb.select().from(C).where(ops.eq(C.groupId, copied.data.id));
		expect(rows.map((r) => [r.title, r.dueDate, r.doneOn, r.archivedAt]).sort()).toEqual([
			["Accounting", "2027-11-22", null, null],
			["Start check", "2027-11-25", null, null],
		]);
		const items = await testDb
			.select()
			.from(schema.seiryuChecklistItems)
			.where(
				ops.inArray(
					schema.seiryuChecklistItems.cardId,
					rows.map((r) => r.id),
				),
			);
		expect(items.map((i) => i.isCompleted)).toEqual([false]);
	});

	it("a card done over a week ago goes to the archive; a newer one stays", async () => {
		const { card, done } = await seed({ repeatEvery: null, repeatUnit: null });
		const [recent] = await testDb
			.insert(C)
			.values({
				projectId: card.projectId,
				columnId: done.id,
				title: "Fresh",
				position: "a1",
				doneOn: "2026-11-01",
			})
			.returning();
		await moveCard({ cardId: card.id, newColumnId: done.id });
		await testDb.update(C).set({ doneOn: "2026-10-29" }).where(ops.eq(C.id, card.id));

		expect(await archiveFinishedCards("2026-11-06")).toBe(1);
		const rows = await testDb.select().from(C);
		expect(rows.find((r) => r.id === card.id)?.archivedAt).not.toBeNull();
		expect(rows.find((r) => r.id === recent?.id)?.archivedAt).toBeNull();
	});
});

describe("late repeating cards", () => {
	beforeAll(async () => {
		testDb = await createTestDb();
	}, 30_000);

	afterEach(async () => {
		await testDb.delete(schema.workspaces);
		today = "2026-11-06";
	});

	it("a missed daily card moves to today with its reminder", async () => {
		today = "2026-11-28";
		const { card } = await seed({ dueDate: "2026-11-23", repeatEvery: 1, repeatUnit: "day" });
		expect(await catchUpRepeats()).toBe(1);
		const [row] = await testDb.select().from(C).where(ops.eq(C.id, card.id));
		expect(row.dueDate).toBe("2026-11-28");
		// No zone saved: UTC, at its 10:00.
		expect(row.remindAt?.toISOString()).toBe("2026-11-28T10:00:00.000Z");
	});

	it("leaves a weekly card late until its next step", async () => {
		today = "2026-11-28";
		await seed({ dueDate: "2026-11-23", repeatEvery: 1, repeatUnit: "week" });
		expect(await catchUpRepeats()).toBe(0);
	});

	it("leaves a card counted from done", async () => {
		today = "2026-11-28";
		await seed({ dueDate: "2026-11-23", repeatEvery: 1, repeatUnit: "day", repeatFromDone: true });
		expect(await catchUpRepeats()).toBe(0);
	});
});
