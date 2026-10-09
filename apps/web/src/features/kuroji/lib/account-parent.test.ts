import { describe, expect, it } from "vitest";
import { parentError } from "./account-parent";

// food → groceries → produce; transport stands alone.
const accounts = [
	{ id: "food", parentId: null },
	{ id: "groceries", parentId: "food" },
	{ id: "produce", parentId: "groceries" },
	{ id: "transport", parentId: null },
];

describe("parentError", () => {
	it("allows a parent in the same workspace", () => {
		expect(parentError("transport", "food", accounts)).toBeNull();
		expect(parentError("produce", "food", accounts)).toBeNull();
	});

	it("rejects a parent outside the workspace", () => {
		expect(parentError("food", "elsewhere", accounts)).toBe("Parent account not found");
	});

	it("rejects the account itself", () => {
		expect(parentError("food", "food", accounts)).toMatch(/itself/);
	});

	it("rejects any of its sub-accounts", () => {
		expect(parentError("food", "groceries", accounts)).toMatch(/sub-accounts/);
		expect(parentError("food", "produce", accounts)).toMatch(/sub-accounts/);
	});

	it("stops on a loop already in the data", () => {
		const looped = [
			{ id: "a", parentId: "b" },
			{ id: "b", parentId: "a" },
			{ id: "c", parentId: null },
		];
		expect(parentError("c", "a", looped)).toBeNull();
	});
});
