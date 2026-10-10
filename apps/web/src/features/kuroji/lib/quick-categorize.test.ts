import { describe, expect, it } from "vitest";
import {
	categoryEnd,
	isUncategorized,
	pickableCategories,
	recentCategoryIds,
} from "./quick-categorize";

const txn = (
	from: [string, string],
	to: [string, string],
	opts: { splitCount?: number; currency?: string } = {},
) => ({
	splitCount: opts.splitCount ?? 1,
	fromAccountId: from[0],
	fromAccountType: from[1],
	toAccountId: to[0],
	toAccountType: to[1],
	legs: [
		{ accountId: from[0], currency: "PLN" },
		{ accountId: to[0], currency: opts.currency ?? "PLN" },
	],
});

describe("categoryEnd", () => {
	it("is the expense of a purchase", () => {
		expect(categoryEnd(txn(["card", "ASSET"], ["food", "EXPENSE"]))).toEqual({
			kind: "EXPENSE",
			categoryId: "food",
			currency: "PLN",
		});
	});

	it("is the income of a salary, also into a credit card", () => {
		expect(categoryEnd(txn(["salary", "INCOME"], ["card", "LIABILITY"]))?.categoryId).toBe(
			"salary",
		);
	});

	it("carries the category leg's currency", () => {
		expect(categoryEnd(txn(["card", "ASSET"], ["food", "EXPENSE"], { currency: "EUR" }))).toEqual(
			expect.objectContaining({ currency: "EUR" }),
		);
	});

	it("is null for transfers and splits", () => {
		expect(categoryEnd(txn(["card", "ASSET"], ["cash", "ASSET"]))).toBeNull();
		expect(categoryEnd(txn(["card", "ASSET"], ["food", "EXPENSE"], { splitCount: 2 }))).toBeNull();
		expect(categoryEnd({ ...txn(["card", "ASSET"], ["food", "EXPENSE"]), legs: [] })).toBeNull();
	});

	it("is null when both ends are categories", () => {
		expect(categoryEnd(txn(["salary", "INCOME"], ["food", "EXPENSE"]))).toBeNull();
	});
});

describe("isUncategorized", () => {
	it("knows the import fallbacks", () => {
		expect(isUncategorized("Uncategorized Expenses")).toBe(true);
		expect(isUncategorized("Uncategorised income")).toBe(true);
		expect(isUncategorized("Groceries")).toBe(false);
	});
});

describe("recentCategoryIds", () => {
	it("lists each category once, newest first, of one kind", () => {
		const txns = [
			txn(["card", "ASSET"], ["food", "EXPENSE"]),
			txn(["salary", "INCOME"], ["card", "ASSET"]),
			txn(["card", "ASSET"], ["taxi", "EXPENSE"]),
			txn(["card", "ASSET"], ["food", "EXPENSE"]),
		];
		expect(recentCategoryIds(txns, "EXPENSE")).toEqual(["food", "taxi"]);
		expect(recentCategoryIds(txns, "INCOME")).toEqual(["salary"]);
	});
});

describe("pickableCategories", () => {
	const cat = (id: string, name: string, more: Partial<Record<string, string | null>> = {}) => ({
		id,
		name,
		type: "EXPENSE",
		currency: "PLN",
		parentId: null as string | null,
		...more,
	});
	const all = [
		cat("food", "Food"),
		cat("groceries", "Groceries", { parentId: "food" }),
		cat("cafe", "Cafe", { parentId: "food" }),
		cat("taxi", "Taxi"),
		cat("rent", "Rent"),
		cat("unc", "Uncategorized Expenses"),
		cat("eur", "Travel EUR", { currency: "EUR" }),
		cat("salary", "Salary", { type: "INCOME" }),
	];
	const names = (cs: { name: string }[]) => cs.map((c) => c.name);

	it("offers leaf categories of the kind and currency, A to Z", () => {
		expect(
			names(pickableCategories(all, { kind: "EXPENSE", currency: "PLN", recentIds: [] })),
		).toEqual(["Cafe", "Groceries", "Rent", "Taxi"]);
	});

	it("puts recent ones first, in recency order", () => {
		expect(
			names(
				pickableCategories(all, { kind: "EXPENSE", currency: "PLN", recentIds: ["taxi", "cafe"] }),
			),
		).toEqual(["Taxi", "Cafe", "Groceries", "Rent"]);
	});

	it("filters by the search, ignoring case", () => {
		expect(
			names(
				pickableCategories(all, { kind: "EXPENSE", currency: "PLN", recentIds: [], query: " R " }),
			),
		).toEqual(["Groceries", "Rent"]);
	});

	it("offers income categories for money in", () => {
		expect(
			names(pickableCategories(all, { kind: "INCOME", currency: "PLN", recentIds: [] })),
		).toEqual(["Salary"]);
	});
});
