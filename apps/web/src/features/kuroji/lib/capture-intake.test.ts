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

vi.mock("@seikatsu/db", async () => ({
	...schema,
	eq: ops.eq,
	and: ops.and,
	or: ops.or,
	desc: ops.desc,
	asc: ops.asc,
	sql: ops.sql,
	gte: ops.gte,
	lte: ops.lte,
	like: ops.like,
	inArray: ops.inArray,
	ilike: ops.ilike,
	count: ops.count,
	isNull: ops.isNull,
	isNotNull: ops.isNotNull,
	ne: ops.ne,
	get db() {
		return testDb;
	},
}));

async function seed() {
	const [workspace] = await testDb
		.insert(schema.workspaces)
		.values({ userId: "user-1", name: "Test", baseCurrency: "PLN" })
		.returning();
	const [card, groceries, uncategorized] = await testDb
		.insert(schema.accounts)
		.values([
			{ workspaceId: workspace.id, name: "Card", type: "ASSET", currency: "PLN" },
			{ workspaceId: workspace.id, name: "Groceries", type: "EXPENSE", currency: "PLN" },
			{ workspaceId: workspace.id, name: "Uncategorized", type: "EXPENSE", currency: "PLN" },
		])
		.returning();
	return { workspace, card, groceries, uncategorized };
}

async function capture(workspaceId: string, amount: string, paidAt: string) {
	const [row] = await testDb
		.insert(schema.kurojiCaptures)
		.values({
			workspaceId,
			amount,
			currency: "PLN",
			merchant: "Biedronka",
			paidAt: new Date(paidAt),
		})
		.returning();
	return row;
}

const captureState = async (id: string) =>
	(
		await testDb.select().from(schema.kurojiCaptures).where(ops.eq(schema.kurojiCaptures.id, id))
	)[0];

describe("Apple Pay captures meet bank imports", () => {
	beforeAll(async () => {
		testDb = await createTestDb();
	}, 30_000);

	afterEach(async () => {
		await testDb.delete(schema.kurojiCaptures);
		await testDb.delete(schema.transactions);
		await testDb.delete(schema.accounts);
		await testDb.delete(schema.workspaces);
	});

	it("a saved payment is claimed by the bank's booking, not doubled", async () => {
		const { workspace, card, groceries, uncategorized } = await seed();
		const paid = await capture(workspace.id, "12.5000", "2026-10-20T10:00:00Z");
		const { createTransaction } = await import("../actions/transactions");
		const { insertImported } = await import("./import-core");

		const saved = await createTransaction({
			workspaceId: workspace.id,
			fromAccountId: card.id,
			toSplits: [{ accountId: groceries.id, amount: 12.5 }],
			currency: "PLN",
			date: "2026-10-20",
			captureId: paid.id,
		});
		expect(saved).toMatchObject({ success: true });
		expect(await captureState(paid.id)).toMatchObject({ state: "added" });

		const booking = {
			workspaceId: workspace.id,
			externalId: "bank-1",
			date: "2026-10-22",
			description: "BIEDRONKA 337",
			bankAccountId: card.id,
			counterpartId: uncategorized.id,
			isInflow: false,
			amount: 12.5,
			currency: "PLN",
			baseCurrency: "PLN",
		};
		expect(await insertImported(booking)).toBe(false);
		expect(await insertImported(booking)).toBe(false);

		const all = await testDb.select().from(schema.transactions);
		expect(all).toHaveLength(1);
		expect(all[0]).toMatchObject({ externalId: "bank-1", description: null });
	});

	it("a payment still in the inbox leaves it when the bank books it first", async () => {
		const { workspace, card, groceries, uncategorized } = await seed();
		const paid = await capture(workspace.id, "30.0000", "2026-10-20T18:00:00Z");
		const { createTransaction } = await import("../actions/transactions");
		const { insertImported } = await import("./import-core");

		const created = await insertImported({
			workspaceId: workspace.id,
			externalId: "bank-2",
			date: "2026-10-21",
			description: "BIEDRONKA",
			bankAccountId: card.id,
			counterpartId: uncategorized.id,
			isInflow: false,
			amount: 30,
			currency: "PLN",
			baseCurrency: "PLN",
		});
		expect(created).toBe(true);
		expect(await captureState(paid.id)).toMatchObject({ state: "matched" });

		const late = await createTransaction({
			workspaceId: workspace.id,
			fromAccountId: card.id,
			toSplits: [{ accountId: groceries.id, amount: 30 }],
			currency: "PLN",
			date: "2026-10-20",
			captureId: paid.id,
		});
		expect(late).toEqual({ error: "This payment is already in Kuroji." });
		expect(await testDb.select().from(schema.transactions)).toHaveLength(1);
	});

	it("a different amount is a different payment", async () => {
		const { workspace, card, uncategorized } = await seed();
		const paid = await capture(workspace.id, "30.0000", "2026-10-20T18:00:00Z");
		const { insertImported } = await import("./import-core");

		await insertImported({
			workspaceId: workspace.id,
			externalId: "bank-3",
			date: "2026-10-21",
			description: "ZABKA",
			bankAccountId: card.id,
			counterpartId: uncategorized.id,
			isInflow: false,
			amount: 31,
			currency: "PLN",
			baseCurrency: "PLN",
		});
		expect(await captureState(paid.id)).toMatchObject({ state: "pending" });
	});
});
