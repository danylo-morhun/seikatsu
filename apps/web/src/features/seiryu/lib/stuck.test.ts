import { expect, it } from "vitest";
import { stuckDays } from "./types";

it("counts a card stuck from a week in its column", () => {
	const now = Date.parse("2026-11-06T12:00:00Z");
	expect(stuckDays("2026-11-01T12:00:00Z", now)).toBeNull();
	expect(stuckDays("2026-10-30T12:00:00Z", now)).toBe(7);
	expect(stuckDays("2026-10-20T08:00:00Z", now)).toBe(17);
});
