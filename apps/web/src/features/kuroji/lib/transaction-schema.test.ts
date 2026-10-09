import { describe, expect, it } from "vitest";
import { amountSchema, parseAmount } from "./transaction-schema";

describe("parseAmount", () => {
	it("accepts a decimal comma or dot", () => {
		expect(parseAmount("12,50")).toBe(12.5);
		expect(parseAmount("12.50")).toBe(12.5);
		expect(parseAmount("12")).toBe(12);
		expect(parseAmount(",5")).toBe(0.5);
	});

	it("ignores grouping spaces, including no-break spaces", () => {
		expect(parseAmount("1 234,50")).toBe(1234.5);
		expect(parseAmount("1 234,50")).toBe(1234.5);
		expect(parseAmount("1 234,50")).toBe(1234.5);
	});

	it("reads grouping marks: the last mark is the decimal", () => {
		expect(parseAmount("1.234,50")).toBe(1234.5);
		expect(parseAmount("1,234.50")).toBe(1234.5);
		expect(parseAmount("1,234,567.89")).toBe(1234567.89);
		expect(parseAmount("1.234.567")).toBe(1234567);
	});

	it("returns undefined for blank input and NaN for garbage", () => {
		expect(parseAmount("")).toBeUndefined();
		expect(parseAmount("  ")).toBeUndefined();
		expect(parseAmount("abc")).toBeNaN();
		expect(parseAmount("12.5.3")).toBeNaN();
		expect(parseAmount("1,2.3")).toBeNaN();
		expect(parseAmount("12a")).toBeNaN();
		expect(parseAmount(".")).toBeNaN();
	});
});

describe("amountSchema", () => {
	const message = (v: unknown) => amountSchema.safeParse(v).error?.issues[0]?.message;

	it("asks for an amount when blank and a valid one when unreadable", () => {
		expect(message(parseAmount(""))).toBe("Enter an amount");
		expect(message(parseAmount("12.5.3"))).toBe("Enter a valid amount");
		expect(message(parseAmount("-5"))).toBe("Amount must be more than zero");
		expect(message(parseAmount("1.234,50"))).toBeUndefined();
	});
});
