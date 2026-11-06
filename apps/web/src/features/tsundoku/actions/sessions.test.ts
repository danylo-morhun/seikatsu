import * as schema from "@seikatsu/db/schema";
import { createTestDb } from "@seikatsu/db/test-utils";
import * as ops from "drizzle-orm";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

let testDb: Awaited<ReturnType<typeof createTestDb>>;
let workspaceId = "";

vi.mock("@/lib/session", () => ({
	isUuid: (v: string) => /^[0-9a-f-]{36}$/i.test(v),
	requireWorkspace: vi.fn(async () => ({ id: workspaceId })),
}));
vi.mock("@/lib/timezone", () => ({ getUserToday: vi.fn(async () => "2026-11-06") }));
vi.mock("@/lib/revalidate", () => ({ revalidateShell: vi.fn() }));
vi.mock("@/features/keizoku/lib/from-reading", () => ({ tickReadingHabits: vi.fn() }));
vi.mock("@/features/tsundoku/lib/cover-store", () => ({ dropCover: vi.fn(), storeCover: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/server", () => ({ after: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("react", async (orig) => ({ ...(await orig<object>()), cache: <T>(fn: T) => fn }));

// Real Postgres (PGlite, real migrations) in place of the network DB.
vi.mock("@seikatsu/db", async () => ({
	...schema,
	...ops,
	get db() {
		return testDb;
	},
}));

const T = schema.tsundokuBooks;
const S = schema.tsundokuSessions;

async function seed(book: Partial<typeof T.$inferInsert> = {}) {
	const [workspace] = await testDb
		.insert(schema.workspaces)
		.values({ userId: "user-1", name: "W", baseCurrency: "USD" })
		.returning();
	workspaceId = workspace.id;
	const [row] = await testDb
		.insert(T)
		.values({ workspaceId, title: "Book", pageCount: 300, position: "a0", ...book })
		.returning();
	return row;
}

const read = async (id: string) => (await testDb.select().from(T).where(ops.eq(T.id, id)))[0];
const sessions = () => testDb.select().from(S).orderBy(S.date);

describe("page logging", () => {
	beforeAll(async () => {
		testDb = await createTestDb();
	}, 30_000);

	afterEach(async () => {
		await testDb.delete(S);
		await testDb.delete(T);
		await testDb.delete(schema.workspaces);
	});

	it("logs one page as one page", async () => {
		const book = await seed({ status: "reading", currentPage: 10 });
		const { logSession } = await import("./sessions");
		expect(await logSession(book.id, { date: "2026-11-06", pagesRead: 1 })).toEqual({
			success: true,
		});
		expect((await sessions()).map((s) => s.pagesRead)).toEqual([1]);
		expect((await read(book.id)).currentPage).toBe(11);
	});

	it("moving one page forward logs one page", async () => {
		const book = await seed({ status: "reading", currentPage: 10 });
		const { setProgress } = await import("./books");
		await setProgress(book.id, { currentPage: 11 });
		expect((await sessions()).map((s) => s.pagesRead)).toEqual([1]);
	});

	it("a book finished by hand still logs a day", async () => {
		const book = await seed({ status: "read", currentPage: 300, finishedAt: "2026-11-01" });
		const { logSession } = await import("./sessions");
		await logSession(book.id, { date: "2026-10-30", pagesRead: 1 });
		expect((await sessions()).map((s) => s.pagesRead)).toEqual([1]);
	});

	it("moving a mistaken day's date keeps the page", async () => {
		const book = await seed({ status: "reading", currentPage: 0 });
		const { logSession, updateSession } = await import("./sessions");
		await logSession(book.id, { date: "2026-11-06", pagesRead: 30 });
		const [day] = await sessions();
		await updateSession(day.id, { date: "2026-11-05", pagesRead: 30 });
		expect((await read(book.id)).currentPage).toBe(30);
		expect((await sessions())[0]).toMatchObject({ date: "2026-11-05", pagesRead: 30 });
	});
});
