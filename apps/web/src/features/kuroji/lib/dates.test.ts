import { describe, expect, it } from "vitest";
import { previousRange } from "./dates";

describe("previousRange", () => {
	it("steps back one whole month", () => {
		expect(previousRange("2026-10-01", "2026-10-31")).toEqual({
			from: "2026-09-01",
			to: "2026-09-30",
		});
	});

	it("keeps multi-month ranges month-aligned across years", () => {
		expect(previousRange("2026-01-01", "2026-03-31")).toEqual({
			from: "2025-10-01",
			to: "2025-12-31",
		});
	});

	it("shifts arbitrary ranges by their length in days", () => {
		expect(previousRange("2026-10-05", "2026-10-11")).toEqual({
			from: "2026-09-28",
			to: "2026-10-04",
		});
	});
});
