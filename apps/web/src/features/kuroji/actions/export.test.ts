import type { TransactionFilters } from "@/features/kuroji/lib/transaction-filters";
import * as schema from "@seikatsu/db/schema";
import { createTestDb } from "@seikatsu/db/test-utils";
import * as ops from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";

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

const ids = {} as Record<"ws" | "bank" | "savings" | "food" | "tag", string>;

async function addTxn(date: string, description: string, from: string, to: string, amount: number) {
	const [txn] = await testDb
		.insert(schema.transactions)
		.values({ workspaceId: ids.ws, date, description })
		.returning();
	await testDb.insert(schema.transactionEntries).values([
		{
			transactionId: txn.id,
			accountId: from,
			amount: String(-amount),
			currency: "PLN",
			baseAmount: String(-amount),
		},
		{
			transactionId: txn.id,
			accountId: to,
			amount: String(amount),
			currency: "PLN",
			baseAmount: String(amount),
		},
	]);
	return txn.id;
}

/** CSV data rows, without the header. */
function csvRows(csv: string) {
	return csv.split("\n").slice(1);
}

describe("exportTransactionsCsv — same rows as the list", () => {
	beforeAll(async () => {
		testDb = await createTestDb();
		const [ws] = await testDb
			.insert(schema.workspaces)
			.values({ userId: "user-1", name: "Test", baseCurrency: "PLN" })
			.returning();
		ids.ws = ws.id;
		const [bank] = await testDb
			.insert(schema.accounts)
			.values({ workspaceId: ws.id, name: "Bank", type: "ASSET", currency: "PLN" })
			.returning();
		const [savings, food] = await testDb
			.insert(schema.accounts)
			.values([
				{ workspaceId: ws.id, name: "Savings", type: "ASSET", currency: "PLN", parentId: bank.id },
				{ workspaceId: ws.id, name: "Food", type: "EXPENSE", currency: "PLN" },
			])
			.returning();
		Object.assign(ids, { bank: bank.id, savings: savings.id, food: food.id });
		const [tag] = await testDb
			.insert(schema.tags)
			.values({ workspaceId: ws.id, name: "trip" })
			.returning();
		ids.tag = tag.id;

		await addTxn("2026-05-01", "Lunch", bank.id, food.id, 10);
		const tagged = await addTxn("2026-05-02", "Trip dinner", bank.id, food.id, 30);
		await testDb.insert(schema.transactionTags).values({ transactionId: tagged, tagId: tag.id });
		await addTxn("2026-05-03", "Snack from savings", savings.id, food.id, 5);
		await addTxn("2026-06-01", "Lunch", bank.id, food.id, 20);
	}, 30_000);

	const cases: [string, () => TransactionFilters][] = [
		["no filters", () => ({})],
		["tag", () => ({ tagId: ids.tag })],
		["parent account with its sub-account", () => ({ accountIds: [ids.bank, ids.savings] })],
		["sub-account only", () => ({ accountIds: [ids.savings] })],
		["period + search", () => ({ from: "2026-05-01", to: "2026-05-31", q: "lunch" })],
		["amount sort", () => ({ sortField: "amount", sortDir: "asc" })],
	];

	it.each(cases)("%s", async (_, make) => {
		const filters = make();
		const { getRecentTransactions } = await import("./transactions");
		const { exportTransactionsCsv } = await import("./export");

		const list = await getRecentTransactions(ids.ws, filters, 0);
		const result = await exportTransactionsCsv(ids.ws, filters);
		if ("error" in result) throw new Error(result.error);

		const rows = csvRows(result.csv);
		expect(rows).toHaveLength(list.total);
		// Same order: each CSV row starts with the list row's date and description.
		expect(rows.map((r) => r.split(",").slice(0, 2).join(","))).toEqual(
			list.rows.map((t) => `${t.date},"${t.description}"`),
		);
	});

	it("the tag filter narrows the export", async () => {
		const { exportTransactionsCsv } = await import("./export");
		const result = await exportTransactionsCsv(ids.ws, { tagId: ids.tag });
		if ("error" in result) throw new Error(result.error);
		expect(csvRows(result.csv)).toEqual([expect.stringContaining("Trip dinner")]);
	});

	it("a list page past the end shows the last page", async () => {
		const { getRecentTransactions } = await import("./transactions");
		const list = await getRecentTransactions(ids.ws, {}, 99);
		expect(list.page).toBe(0);
		expect(list.rows).toHaveLength(4);
	});

	it("rejects malformed filters", async () => {
		const { exportTransactionsCsv } = await import("./export");
		expect(await exportTransactionsCsv(ids.ws, { tagId: "not-a-uuid" })).toEqual({
			error: "Invalid filters",
		});
	});
});
