import type { FormAccount } from "@/features/kuroji/actions/form-options";
import type { RecentTransaction } from "@/features/kuroji/actions/transactions";
import type { Op, OpName } from "@/features/pwa/lib/ops";
import { describe, expect, it } from "vitest";
import { overlayTransactions } from "./overlay";

const accounts = [
	{ id: "bank", name: "Bank", type: "ASSET", currency: "PLN" },
	{ id: "food", name: "Food", type: "EXPENSE", currency: "PLN" },
] as FormAccount[];

let n = 0;
function op<N extends OpName>(name: N, args: Op<N>["args"]): Op {
	return { opId: `op${n++}`, name, args, label: "", createdAt: n, status: "pending" } as Op;
}

const server = (id: string, date: string) =>
	({
		id,
		date,
		description: id,
		legs: [],
		tags: [{ id: "t", name: "x", color: null }],
	}) as unknown as RecentTransaction;

const capture = (id: string, date: string, amount: number) =>
	op("kuroji.createTransaction", {
		workspaceId: "ws",
		id,
		fromAccountId: "bank",
		toSplits: [{ accountId: "food", amount }],
		currency: "PLN",
		description: "Lunch",
		date,
	});

const OPTS = { firstPage: true, byDateDesc: true };

describe("overlayTransactions", () => {
	it("puts an offline capture in date order, marked pending, with legs for the edit form", () => {
		const rows = overlayTransactions(
			[server("a", "2026-10-27"), server("b", "2026-10-20")],
			[capture("new", "2026-10-25", 30)],
			accounts,
			"PLN",
			OPTS,
		);
		expect(rows.map((r) => r.id)).toEqual(["a", "new", "b"]);
		const added = rows[1];
		expect(added).toMatchObject({
			pending: true,
			fromAccount: "Bank",
			toAccount: "Food",
			toAccountType: "EXPENSE",
			amount: "30.0000",
			baseAmount: "30.0000",
		});
		expect(added.legs.map((l) => l.amount)).toEqual(["-30.0000", "30.0000"]);
	});

	it("an edit before sync replaces the capture; a delete drops it", () => {
		const edited = overlayTransactions(
			[],
			[
				capture("new", "2026-10-25", 30),
				op("kuroji.updateTransaction", {
					transactionId: "new",
					fromAccountId: "bank",
					toSplits: [{ accountId: "food", amount: 45 }],
					currency: "PLN",
					date: "2026-10-25",
				}),
			],
			accounts,
			"PLN",
			OPTS,
		);
		expect(edited.map((r) => r.amount)).toEqual(["45.0000"]);

		const dropped = overlayTransactions(
			[],
			[capture("new", "2026-10-25", 30), op("kuroji.deleteTransaction", { transactionId: "new" })],
			accounts,
			"PLN",
			OPTS,
		);
		expect(dropped).toEqual([]);
	});

	it("hides deleted server rows, marks edited ones and keeps their tags", () => {
		const rows = overlayTransactions(
			[server("a", "2026-10-27"), server("b", "2026-10-20")],
			[
				op("kuroji.deleteTransaction", { transactionId: "a" }),
				op("kuroji.updateTransaction", {
					transactionId: "b",
					fromAccountId: "bank",
					toAccountId: "food",
					amount: 9,
					currency: "PLN",
					date: "2026-10-20",
				}),
			],
			accounts,
			"PLN",
			OPTS,
		);
		expect(rows.map((r) => [r.id, r.pending, r.amount, r.tags.length])).toEqual([
			["b", true, "9.0000", 1],
		]);
	});

	it("shows new captures only on the first page", () => {
		const rows = overlayTransactions([], [capture("new", "2026-10-25", 30)], accounts, "PLN", {
			firstPage: false,
			byDateDesc: true,
		});
		expect(rows).toEqual([]);
	});
});
