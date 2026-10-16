import { describe, expect, it } from "vitest";
import { normalizeSource } from "./sources";

describe("normalizeSource", () => {
	it("maps a board's spellings to one name", () => {
		expect(normalizeSource("justjoin.it")).toBe("JustJoin");
		expect(normalizeSource(" JUSTJOIN ")).toBe("JustJoin");
		expect(normalizeSource("djinni")).toBe("Djinni");
	});

	it("keeps unknown sources as typed, and blank as none", () => {
		expect(normalizeSource("Company Website")).toBe("Company Website");
		expect(normalizeSource("  ")).toBeNull();
		expect(normalizeSource(undefined)).toBeNull();
	});
});
