import { describe, expect, it } from "vitest";
import { categoryTiles, pickUsage, postableCategories } from "./category-tiles";

const cat = (id: string, name: string, parentId: string | null = null) => ({ id, name, parentId });
const categories = [
	cat("rent", "Rent"),
	cat("food", "Food"),
	cat("groceries", "Groceries", "food"),
	cat("cafes", "Cafes", "food"),
	cat("fun", "Fun"),
	cat("unc", "Uncategorized Expenses"),
	cat("gifts", "Gifts"),
];
const ids = (list: { id: string }[]) => list.map((c) => c.id);

describe("pickUsage", () => {
	it("ranks by recent usage when there is enough of it", () => {
		const recent = { rent: 15, fun: 5 };
		expect(pickUsage(recent, { gifts: 99 })).toBe(recent);
	});

	it("falls back to all time when recent usage is sparse", () => {
		const allTime = { gifts: 99 };
		expect(pickUsage({ rent: 3 }, allTime)).toBe(allTime);
	});
});

describe("postableCategories", () => {
	it("offers leaves only, recent first then A–Z", () => {
		expect(ids(postableCategories(categories, ["rent"]))).toEqual([
			"rent",
			"cafes",
			"fun",
			"gifts",
			"groceries",
			"unc",
		]);
	});

	it("matches the search", () => {
		expect(ids(postableCategories(categories, [], "  GR "))).toEqual(["groceries"]);
	});
});

describe("categoryTiles", () => {
	it("tops recent up A–Z and skips the fallback bucket", () => {
		expect(ids(categoryTiles(categories, { recentIds: ["gifts"], count: 4 }))).toEqual([
			"gifts",
			"cafes",
			"fun",
			"groceries",
		]);
	});

	it("keeps the fallback bucket when it was used recently", () => {
		expect(ids(categoryTiles(categories, { recentIds: ["unc"], count: 2 }))).toEqual([
			"unc",
			"cafes",
		]);
	});

	it("ignores recent ids that no longer exist", () => {
		expect(ids(categoryTiles(categories, { recentIds: ["gone"], count: 2 }))).toEqual([
			"cafes",
			"fun",
		]);
	});

	it("puts a chosen category outside the tiles on the last tile", () => {
		expect(ids(categoryTiles(categories, { recentIds: [], selectedId: "rent", count: 3 }))).toEqual(
			["cafes", "fun", "rent"],
		);
	});

	it("leaves the tiles alone when the choice is already on one", () => {
		expect(ids(categoryTiles(categories, { recentIds: [], selectedId: "fun", count: 3 }))).toEqual([
			"cafes",
			"fun",
			"gifts",
		]);
	});

	it("shows a parent picked by an older transaction", () => {
		expect(ids(categoryTiles(categories, { recentIds: [], selectedId: "food", count: 2 }))).toEqual(
			["cafes", "food"],
		);
	});
});
