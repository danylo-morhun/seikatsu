import { describe, expect, it } from "vitest";
import { generateKeyBetween, generateNKeysBetween } from "./position";

describe("fractional indexing (position.ts)", () => {
	it("moving a card between two neighbors gives a key strictly between them", () => {
		const before = "a0";
		const after = "a1";
		const moved = generateKeyBetween(before, after);
		expect(moved > before).toBe(true);
		expect(moved < after).toBe(true);
	});

	it("repeated moves into the same gap never collide", () => {
		const lo = "a0";
		const hi = "a1";
		const seen = new Set<string>();
		let cursor = lo;
		for (let i = 0; i < 25; i++) {
			const key = generateKeyBetween(cursor, hi);
			expect(seen.has(key)).toBe(false);
			seen.add(key);
			expect(key > cursor).toBe(true);
			expect(key < hi).toBe(true);
			cursor = key;
		}
	});

	it("generateNKeysBetween produces N distinct, ordered keys", () => {
		const keys = generateNKeysBetween(null, null, 5);
		expect(keys).toHaveLength(5);
		expect(new Set(keys).size).toBe(5);
		for (let i = 1; i < keys.length; i++) {
			expect(keys[i] > keys[i - 1]).toBe(true);
		}
	});
});
