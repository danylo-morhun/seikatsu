import { describe, expect, it } from "vitest";
import { categoryTiles, pickUsage } from "./category-tiles";

const cat = (id: string, name: string, parentId: string | null = null) => ({ id, name, parentId });
const categories = [
	cat("rent", "Rent"),
	cat("food", "Food"),
	cat("groceries", "Groceries", "food"),
	cat("cafes", "Cafes", "food"),
	cat("fun", "Fun"),
	cat("unc", "Uncategorized Expenses"),
	cat("open", "Opening Balance"),
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

describe("categoryTiles", () => {
	it("puts the most used first, ties A–Z, parents never", () => {
		const usage = { fun: 2, rent: 9, groceries: 2, food: 50 };
		expect(ids(categoryTiles(categories, { usage, count: 5 }))).toEqual([
			"rent",
			"fun",
			"groceries",
			"cafes",
			"gifts",
		]);
	});

	it("keeps the fallback bucket and system accounts off, however used", () => {
		const usage = { unc: 40, open: 30 };
		expect(ids(categoryTiles(categories, { usage, count: 2 }))).toEqual(["cafes", "fun"]);
	});

	it("offers the fallback bucket when nothing else exists", () => {
		const only = [cat("unc", "Uncategorized Income")];
		expect(ids(categoryTiles(only, { usage: {}, count: 5 }))).toEqual(["unc"]);
	});

	it("ignores usage of categories that no longer exist", () => {
		expect(ids(categoryTiles(categories, { usage: { gone: 9 }, count: 2 }))).toEqual([
			"cafes",
			"fun",
		]);
	});

	it("puts a chosen category outside the tiles on the last tile", () => {
		const usage = { cafes: 3, fun: 2, gifts: 1 };
		expect(ids(categoryTiles(categories, { usage, selectedId: "rent", count: 3 }))).toEqual([
			"cafes",
			"fun",
			"rent",
		]);
	});

	it("leaves the tiles alone when the choice is already on one", () => {
		expect(ids(categoryTiles(categories, { usage: {}, selectedId: "fun", count: 3 }))).toEqual([
			"cafes",
			"fun",
			"gifts",
		]);
	});

	it("shows a parent picked by an older transaction", () => {
		expect(ids(categoryTiles(categories, { usage: {}, selectedId: "food", count: 2 }))).toEqual([
			"cafes",
			"food",
		]);
	});
});
