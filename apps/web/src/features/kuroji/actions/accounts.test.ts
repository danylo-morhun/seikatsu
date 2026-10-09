import * as schema from "@seikatsu/db/schema";
import { createTestDb } from "@seikatsu/db/test-utils";
import * as ops from "drizzle-orm";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

let testDb: Awaited<ReturnType<typeof createTestDb>>;

vi.mock("@/auth", () => ({
	auth: vi.fn(async () => ({ user: { id: "user-1" } })),
}));

vi.mock("next/cache", () => ({
	revalidatePath: vi.fn(),
}));

// Real Postgres (PGlite, real migrations) in place of the network DB.
vi.mock("@seikatsu/db", async () => ({
	...schema,
	eq: ops.eq,
	and: ops.and,
	or: ops.or,
	isNull: ops.isNull,
	get db() {
		return testDb;
	},
}));

async function seed() {
	const [workspace] = await testDb
		.insert(schema.workspaces)
		.values({ userId: "user-1", name: "Test workspace", baseCurrency: "USD" })
		.returning();
	const [checking, rent] = await testDb
		.insert(schema.accounts)
		.values([
			{ workspaceId: workspace.id, name: "Checking", type: "ASSET", currency: "USD" },
			{ workspaceId: workspace.id, name: "Rent", type: "EXPENSE", currency: "USD" },
		])
		.returning();
	return { workspace, checking, rent };
}

describe("deleteAccount", () => {
	beforeAll(async () => {
		testDb = await createTestDb();
	}, 30_000);

	afterEach(async () => {
		await testDb.delete(schema.recurringTransactions);
		await testDb.delete(schema.accounts);
		await testDb.delete(schema.workspaces);
	});

	it("refuses an account a recurring payment uses", async () => {
		const { workspace, checking, rent } = await seed();
		await testDb.insert(schema.recurringTransactions).values({
			workspaceId: workspace.id,
			fromAccountId: checking.id,
			toAccountId: rent.id,
			amount: "900",
			currency: "USD",
			frequency: "monthly",
			nextDate: "2026-11-01",
		});
		const { deleteAccount } = await import("./accounts");

		const expected = {
			error: "This account is used by a recurring payment. Delete or change it first.",
		};
		expect(await deleteAccount(checking.id)).toEqual(expected);
		expect(await deleteAccount(rent.id)).toEqual(expected);
		expect(await testDb.select().from(schema.accounts)).toHaveLength(2);
	});

	it("deletes an unused account", async () => {
		const { rent } = await seed();
		const { deleteAccount } = await import("./accounts");

		expect(await deleteAccount(rent.id)).toEqual({ success: true });
		expect(await testDb.select().from(schema.accounts)).toHaveLength(1);
	});
});
