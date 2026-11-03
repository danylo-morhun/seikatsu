import { describe, expect, it } from "vitest";
import { isCaptureKey } from "./key";

const press = (
	code: string,
	mods: Partial<Record<"metaKey" | "ctrlKey" | "altKey" | "shiftKey", boolean>> = {},
) => ({
	code,
	metaKey: false,
	ctrlKey: false,
	altKey: false,
	shiftKey: false,
	...mods,
});

describe("isCaptureKey", () => {
	it("opens on ⌘K and Ctrl+K, on any layout", () => {
		expect(isCaptureKey(press("KeyK", { metaKey: true }))).toBe(true);
		expect(isCaptureKey(press("KeyK", { ctrlKey: true }))).toBe(true);
	});

	it("leaves plain K and other chords alone", () => {
		expect(isCaptureKey(press("KeyK"))).toBe(false);
		expect(isCaptureKey(press("KeyK", { metaKey: true, shiftKey: true }))).toBe(false);
		expect(isCaptureKey(press("KeyJ", { metaKey: true }))).toBe(false);
	});
});
