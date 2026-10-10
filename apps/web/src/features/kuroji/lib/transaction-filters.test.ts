import { describe, expect, it } from "vitest";
import { clampPage } from "./transaction-filters";

describe("clampPage", () => {
	it("keeps a page inside the range", () => {
		expect(clampPage(0, 55, 10)).toBe(0);
		expect(clampPage(5, 55, 10)).toBe(5);
	});

	it("moves a page past the end to the last page", () => {
		expect(clampPage(99, 55, 10)).toBe(5);
		expect(clampPage(6, 60, 10)).toBe(5);
	});

	it("is page 0 for an empty list", () => {
		expect(clampPage(3, 0)).toBe(0);
	});

	it("never goes below page 0", () => {
		expect(clampPage(-2, 55, 10)).toBe(0);
	});

	it("follows the page size", () => {
		expect(clampPage(10, 25, 5)).toBe(4);
	});

	it("uses the list page size by default", () => {
		expect(clampPage(3, 120)).toBe(2);
	});
});
