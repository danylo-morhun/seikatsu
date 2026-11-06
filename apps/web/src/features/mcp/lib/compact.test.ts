import { describe, expect, it } from "vitest";
import { compact, page, toText } from "./compact";

describe("compact", () => {
	it("drops what says nothing", () => {
		expect(
			compact({
				a: null,
				b: "",
				c: [],
				d: { e: undefined },
				workspaceId: "x",
				n: 1.23456,
				ok: false,
				s: "x",
			}),
		).toEqual({ n: 1.23, ok: false, s: "x" });
		expect(compact(new Date("2026-11-06T00:00:00Z"))).toBe("2026-11-06");
		expect(compact(new Date("2026-11-06T10:15:30Z"))).toBe("2026-11-06T10:15Z");
	});

	it("keeps an empty answer's shape", () => {
		expect(toText([])).toBe("[]");
		expect(toText({ a: null })).toBe("{}");
		expect(toText("plain")).toBe("plain");
	});

	it("pages", () => {
		expect(page([1, 2, 3], 0, 2)).toEqual({ total: 3, rows: [1, 2], nextOffset: 2 });
		expect(page([1, 2, 3], 2, 2)).toEqual({ total: 3, rows: [3] });
	});
});
