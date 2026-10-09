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

// createTransaction pulls its db client from "@seikatsu/db". Swap it for an
// in-memory PGlite instance (real Postgres, real migrations) so the
// db.transaction()/insert() calls under test are real, without a network DB.
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

async function seedWorkspaceWithAccounts(baseCurrency: string) {
	const [workspace] = await testDb
		.insert(schema.workspaces)
		.values({ userId: "user-1", name: "Test workspace", baseCurrency })
		.returning();

	const [checking, groceries, dining] = await testDb
		.insert(schema.accounts)
		.values([
			{ workspaceId: workspace.id, name: "Checking", type: "ASSET", currency: baseCurrency },
			{ workspaceId: workspace.id, name: "Groceries", type: "EXPENSE", currency: baseCurrency },
			{ workspaceId: workspace.id, name: "Dining", type: "EXPENSE", currency: baseCurrency },
		])
		.returning();

	return { workspace, checking, groceries, dining };
}

async function sumBaseAmount(transactionId: string) {
	const entries = await testDb
		.select()
		.from(schema.transactionEntries)
		.where(ops.eq(schema.transactionEntries.transactionId, transactionId));
	return entries.reduce((sum, e) => sum + Number(e.baseAmount), 0);
}

describe("createTransaction — double-entry ledger invariant", () => {
	beforeAll(async () => {
		testDb = await createTestDb();
	}, 30_000);

	afterEach(async () => {
		await testDb.delete(schema.transactions);
		await testDb.delete(schema.accounts);
		await testDb.delete(schema.workspaces);
	});

	it("a simple two-entry transaction sums to zero", async () => {
		const { workspace, checking, groceries } = await seedWorkspaceWithAccounts("USD");
		const { createTransaction } = await import("./transactions");

		const result = await createTransaction({
			workspaceId: workspace.id,
			fromAccountId: checking.id,
			toAccountId: groceries.id,
			amount: 42.5,
			currency: "USD",
			date: "2026-06-01",
		});

		expect(result).toEqual({ success: true });

		const [txn] = await testDb.select().from(schema.transactions);
		expect(await sumBaseAmount(txn.id)).toBe(0);
	});

	it("a split transaction with floating-point amounts sums to zero — drift absorbed by the last credit entry", async () => {
		const { workspace, checking, groceries, dining } = await seedWorkspaceWithAccounts("USD");
		const { createTransaction } = await import("./transactions");

		// 10.10 + 20.20 + 33.33 in floating point doesn't sum to a clean value —
		// this is exactly the drift the last credit entry must absorb.
		const result = await createTransaction({
			workspaceId: workspace.id,
			fromAccountId: checking.id,
			currency: "USD",
			date: "2026-06-02",
			toSplits: [
				{ accountId: groceries.id, amount: 10.1 },
				{ accountId: dining.id, amount: 20.2 },
				{ accountId: groceries.id, amount: 33.33 },
			],
		});

		expect(result).toEqual({ success: true });

		const [txn] = await testDb.select().from(schema.transactions);
		const entries = await testDb
			.select()
			.from(schema.transactionEntries)
			.where(ops.eq(schema.transactionEntries.transactionId, txn.id));

		expect(entries).toHaveLength(4); // 1 debit + 3 credit splits
		const total = entries.reduce((sum, e) => sum + Number(e.baseAmount), 0);
		expect(total).toBe(0);
	});

	it("a cross-currency transfer stores each leg in its account's currency", async () => {
		const { workspace, checking } = await seedWorkspaceWithAccounts("PLN");
		const [eur] = await testDb
			.insert(schema.accounts)
			.values({ workspaceId: workspace.id, name: "EUR", type: "ASSET", currency: "EUR" })
			.returning();
		const { createTransaction } = await import("./transactions");

		const result = await createTransaction({
			workspaceId: workspace.id,
			fromAccountId: eur.id,
			toAccountId: checking.id,
			amount: 400,
			currency: "EUR",
			received: 1700,
			date: "2026-06-03",
		});

		expect(result).toEqual({ success: true });
		const entries = await testDb.select().from(schema.transactionEntries);
		const from = entries.find((e) => e.accountId === eur.id);
		const to = entries.find((e) => e.accountId === checking.id);
		expect([from?.amount, from?.currency, from?.baseAmount]).toEqual([
			"-400.0000",
			"EUR",
			"-1700.0000",
		]);
		expect([to?.amount, to?.currency, to?.baseAmount]).toEqual(["1700.0000", "PLN", "1700.0000"]);
	});

	it("converts a leg in another currency at the day's rate when no amount is given", async () => {
		const { workspace, groceries } = await seedWorkspaceWithAccounts("PLN");
		const [uah] = await testDb
			.insert(schema.accounts)
			.values({ workspaceId: workspace.id, name: "UAH", type: "ASSET", currency: "UAH" })
			.returning();
		await testDb
			.insert(schema.exchangeRates)
			.values({ date: "2026-06-04", fromCurrency: "UAH", toCurrency: "PLN", rate: "0.09" });
		const { createTransaction } = await import("./transactions");

		await createTransaction({
			workspaceId: workspace.id,
			fromAccountId: uah.id,
			toAccountId: groceries.id,
			amount: 100,
			currency: "UAH",
			date: "2026-06-04",
		});

		const entries = await testDb.select().from(schema.transactionEntries);
		const to = entries.find((e) => e.accountId === groceries.id);
		expect([to?.amount, to?.currency]).toEqual(["9.0000", "PLN"]);
		expect(entries.reduce((sum, e) => sum + Number(e.baseAmount), 0)).toBe(0);
	});
});
