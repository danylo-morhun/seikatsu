import { describe, expect, it } from "vitest";
import {
	coverBlobBase,
	coverBlobPath,
	coverSrc,
	coverVersion,
	coverWidth,
	storedCoverSrc,
} from "./cover";

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

describe("stored covers", () => {
	it("round-trips a blob URL to its widths", () => {
		const path = coverBlobPath("production", "b1", "https://a.test/1.jpg", 96);
		expect(path).toMatch(/^tsundoku\/covers\/production\/b1\/[0-9a-z]+-96\.webp$/);
		const base = coverBlobBase(`https://store.test/${path}`);
		expect(storedCoverSrc(base, 384)).toBe(`https://store.test/${path.replace("-96", "-384")}`);
	});
});
