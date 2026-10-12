import { describe, expect, it } from "vitest";
import { plainKey, shouldOpenCapture } from "./capture-shortcut";

const key = (
	k: string,
	mods: Partial<{
		code: string;
		ctrlKey: boolean;
		metaKey: boolean;
		altKey: boolean;
		shiftKey: boolean;
	}> = {},
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

	it("reads letters, digits and brackets by physical key on other layouts", () => {
		expect(plainKey(key("т", { code: "KeyN" }), idle)).toBe("n");
		expect(plainKey(key("Ф", { code: "KeyA", shiftKey: true }), idle)).toBe("a");
		expect(plainKey(key("х", { code: "BracketLeft" }), idle)).toBe("[");
		expect(plainKey(key("ї", { code: "BracketRight" }), idle)).toBe("]");
		expect(plainKey(key("1", { code: "Digit1" }), idle)).toBe("1");
		expect(plainKey(key("!", { code: "Digit1", shiftKey: true }), idle)).not.toBe("1");
	});

	it("keeps a Latin layout's own letters", () => {
		// Dvorak: the key typing "n" sits where QWERTY has L.
		expect(plainKey(key("n", { code: "KeyL" }), idle)).toBe("n");
	});

	it("names ? and the delete keys", () => {
		expect(plainKey(key("?", { code: "Slash", shiftKey: true }), idle)).toBe("?");
		expect(plainKey(key(",", { code: "Digit6", shiftKey: true }), idle)).toBe(",");
		expect(plainKey(key("Backspace", { code: "Backspace" }), idle)).toBe("delete");
		expect(plainKey(key("Delete", { code: "Delete" }), idle)).toBe("delete");
	});

	it("ignores named keys, combos, typing and overlays", () => {
		expect(plainKey(key("ArrowUp"), idle)).toBeNull();
		expect(plainKey(key("f", { metaKey: true }), idle)).toBeNull();
		expect(plainKey(key("f"), { ...idle, editableFocused: true })).toBeNull();
		expect(plainKey(key("f"), { ...idle, overlayOpen: true })).toBeNull();
	});
});
