import { describe, expect, it } from "vitest";
import { plainKey, shouldOpenCapture } from "./capture-shortcut";

const key = (
	k: string,
	mods: Partial<{ ctrlKey: boolean; metaKey: boolean; altKey: boolean }> = {},
) => ({
	key: k,
	ctrlKey: false,
	metaKey: false,
	altKey: false,
	...mods,
});
const idle = { editableFocused: false, overlayOpen: false };

describe("shouldOpenCapture", () => {
	it("opens on a plain n or N", () => {
		expect(shouldOpenCapture(key("n"), idle)).toBe(true);
		expect(shouldOpenCapture(key("N"), idle)).toBe(true);
	});

	it("ignores other keys", () => {
		expect(shouldOpenCapture(key("m"), idle)).toBe(false);
	});

	it("leaves Ctrl, Cmd and Alt combos to the browser", () => {
		expect(shouldOpenCapture(key("n", { ctrlKey: true }), idle)).toBe(false);
		expect(shouldOpenCapture(key("n", { metaKey: true }), idle)).toBe(false);
		expect(shouldOpenCapture(key("n", { altKey: true }), idle)).toBe(false);
	});

	it("stays out of the way while typing or with an overlay open", () => {
		expect(shouldOpenCapture(key("n"), { ...idle, editableFocused: true })).toBe(false);
		expect(shouldOpenCapture(key("n"), { ...idle, overlayOpen: true })).toBe(false);
	});
});

describe("plainKey", () => {
	it("gives the lower-cased letter", () => {
		expect(plainKey(key("F"), idle)).toBe("f");
		expect(plainKey(key("a"), idle)).toBe("a");
	});

	it("ignores named keys, combos, typing and overlays", () => {
		expect(plainKey(key("ArrowUp"), idle)).toBeNull();
		expect(plainKey(key("f", { metaKey: true }), idle)).toBeNull();
		expect(plainKey(key("f"), { ...idle, editableFocused: true })).toBeNull();
		expect(plainKey(key("f"), { ...idle, overlayOpen: true })).toBeNull();
	});
});
