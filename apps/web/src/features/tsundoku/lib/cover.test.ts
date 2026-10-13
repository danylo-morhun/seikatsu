import { describe, expect, it } from "vitest";
import { coverSrc, coverVersion, coverWidth } from "./cover";

describe("coverWidth", () => {
	it("snaps to the next rendered width", () => {
		expect(coverWidth("50")).toBe(96);
		expect(coverWidth("192")).toBe(192);
		expect(coverWidth("200")).toBe(384);
		expect(coverWidth("5000")).toBe(384);
	});

	it("falls back on junk", () => {
		expect(coverWidth(null)).toBe(192);
		expect(coverWidth("abc")).toBe(192);
		expect(coverWidth("-1")).toBe(192);
	});
});

describe("coverSrc", () => {
	it("changes when the cover changes", () => {
		const a = coverSrc("b1", "https://a.test/1.jpg");
		expect(a).toMatch(/^\/api\/tsundoku\/cover\/b1\?w=192&v=[0-9a-z]+$/);
		expect(coverVersion("https://a.test/1.jpg")).not.toBe(coverVersion("https://a.test/2.jpg"));
	});
});
