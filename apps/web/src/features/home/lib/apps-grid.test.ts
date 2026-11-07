import { describe, expect, it } from "vitest";
import { spanOf } from "./apps-grid";

/** Cells each row of a grid fills, given its column count and each box's span there. */
function rows(count: number, columns: 2 | 3) {
	const spans = Array.from({ length: count }, (_, i) => {
		const classes = spanOf(i, count).split(" ");
		const lg = classes.find((c) => c.startsWith("lg:col-span-"));
		const base = classes.find((c) => c.startsWith("col-span-"));
		const pick = columns === 3 && lg ? lg : base;
		return pick ? Number(pick.split("-").at(-1)) : 1;
	});
	const filled: number[] = [0];
	for (const span of spans) {
		if (filled[filled.length - 1] + span > columns) filled.push(0);
		filled[filled.length - 1] += span;
	}
	return filled;
}

describe("spanOf", () => {
	for (let count = 1; count <= 7; count++) {
		it(`closes the grid square with ${count} apps`, () => {
			expect(rows(count, 2).every((n) => n === 2)).toBe(true);
			expect(rows(count, 3).every((n) => n === 3)).toBe(true);
		});
	}
});
