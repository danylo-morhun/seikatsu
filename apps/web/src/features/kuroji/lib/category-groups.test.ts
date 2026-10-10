import { describe, expect, it } from "vitest";
import { categoryGroups, searchKey } from "./category-groups";

const cat = (id: string, name: string, parentId: string | null = null) => ({ id, name, parentId });

const categories = [
	cat("food", "Food"),
	cat("groceries", "Groceries", "food"),
	cat("sweets", "Sweets", "food"),
	cat("cafe", "Café", "food"),
	cat("rent", "Rent"),
	cat("gifts", "Gifts"),
	cat("opening", "Opening Balance"),
];

const groups = (opts: Partial<{ value: string; recentIds: string[]; query: string }> = {}) =>
	categoryGroups(categories, { value: "", recentIds: [], query: "", ...opts }).map((g) => [
		g.heading,
		g.options.map((o) => (o.hint ? `${o.label} (${o.hint})` : o.label)),
	]);

describe("searchKey", () => {
	it("drops case and accents", () => {
		expect(searchKey("  Café Łódź ")).toBe("cafe łodz");
	});
});

describe("categoryGroups", () => {
	it("lists top-level categories, then each parent's sub-categories under its name", () => {
		expect(groups()).toEqual([
			[null, ["Gifts", "Rent"]],
			["Food", ["Café", "Groceries", "Sweets"]],
		]);
	});

	it("puts up to five recent categories first, with their parent as a hint", () => {
		expect(groups({ recentIds: ["sweets", "gone", "rent"] })[0]).toEqual([
			"Recent",
			["Sweets (Food)", "Rent"],
		]);
		const named = [cat("gifts", "Gifts"), cat("vita", "Gifts: Vita", "gifts")];
		expect(categoryGroups(named, { value: "", recentIds: ["vita"], query: "" })[0].options).toEqual(
			[{ id: "vita", label: "Gifts: Vita", hint: undefined }],
		);
		const many = ["sweets", "rent", "gifts", "cafe", "groceries", "sweets", "rent"];
		expect(groups({ recentIds: many })[0][1]).toHaveLength(5);
	});

	it("filters by name without case or accents and hides Recent while searching", () => {
		expect(groups({ query: "SW", recentIds: ["rent"] })).toEqual([["Food", ["Sweets"]]]);
		expect(groups({ query: "cafe" })).toEqual([["Food", ["Café"]]]);
	});

	it("finds every sub-category by its parent's name", () => {
		expect(groups({ query: "food" })).toEqual([["Food", ["Café", "Groceries", "Sweets"]]]);
	});

	it("returns nothing when no category matches", () => {
		expect(groups({ query: "zzz" })).toEqual([]);
	});

	it("keeps a parent pickable when it is the current value", () => {
		expect(groups({ value: "food" })[1]).toEqual(["Food", ["Food", "Café", "Groceries", "Sweets"]]);
	});

	it("labels deeper sub-categories by their path", () => {
		const deep = [cat("car", "Car"), cat("fuel", "Fuel", "car"), cat("lpg", "LPG", "fuel")];
		expect(
			categoryGroups(deep, { value: "", recentIds: [], query: "" }).map((g) => g.options),
		).toEqual([[{ id: "lpg", label: "Fuel / LPG" }]]);
	});

	it("never offers the opening-balance account unless it is the current value", () => {
		expect(groups({ query: "opening" })).toEqual([]);
		expect(groups({ query: "opening", value: "opening" })).toEqual([[null, ["Opening Balance"]]]);
	});
});
