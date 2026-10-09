import { describe, expect, it } from "vitest";
import { parseAmount } from "./transaction-schema";

describe("parseAmount", () => {
	it("accepts a decimal comma or dot", () => {
		expect(parseAmount("12,50")).toBe(12.5);
		expect(parseAmount("12.50")).toBe(12.5);
	});

	it("ignores grouping spaces, including narrow no-break spaces", () => {
		expect(parseAmount("1 234,50")).toBe(1234.5);
		expect(parseAmount("1 234,50")).toBe(1234.5);
	});

	it("returns undefined for blank input and NaN for garbage", () => {
		expect(parseAmount("")).toBeUndefined();
		expect(parseAmount("  ")).toBeUndefined();
		expect(parseAmount("abc")).toBeNaN();
	});
});
