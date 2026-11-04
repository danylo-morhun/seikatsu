import { describe, expect, it } from "vitest";
import { APP_SHORTCUTS, GENERAL_SHORTCUTS } from "./shortcuts";

// The grammar every app follows: the same letter means the same thing wherever it's used.
const GRAMMAR: Record<string, RegExp> = {
	N: /^(New|Add|Capture|Log a service)/,
	",": /^Settings$/,
	"/": /^Search/,
};

describe("APP_SHORTCUTS", () => {
	it("gives each key one meaning per screen", () => {
		for (const [path, groups] of Object.entries(APP_SHORTCUTS)) {
			for (const group of groups) {
				const seen = new Map<string, string>();
				for (const item of group.items)
					for (const key of item.keys) {
						expect(seen.get(key), `${path} · ${group.title} · ${key}`).toBeUndefined();
						seen.set(key, item.label);
					}
			}
		}
	});

	it("keeps N, comma and slash to their one meaning", () => {
		for (const groups of Object.values(APP_SHORTCUTS))
			for (const { items } of groups)
				for (const item of items)
					for (const key of item.keys) if (GRAMMAR[key]) expect(item.label).toMatch(GRAMMAR[key]);
	});

	it("leaves the anywhere keys to the shell", () => {
		const shell = new Set(GENERAL_SHORTCUTS.items.flatMap((i) => i.keys));
		for (const groups of Object.values(APP_SHORTCUTS))
			for (const { items } of groups)
				for (const item of items) for (const key of item.keys) expect(shell.has(key)).toBe(false);
	});
});
