import { describe, expect, it } from "vitest";
import { advanceDate } from "./recurring-runner";

describe("advanceDate", () => {
	it("steps daily and weekly across month ends", () => {
		expect(advanceDate("2026-01-31", "daily")).toBe("2026-02-01");
		expect(advanceDate("2026-12-29", "weekly")).toBe("2027-01-05");
	});

	it("clamps monthly to the last day of a shorter month", () => {
		expect(advanceDate("2026-01-31", "monthly")).toBe("2026-02-28");
		expect(advanceDate("2028-01-31", "monthly")).toBe("2028-02-29");
		expect(advanceDate("2026-12-15", "monthly")).toBe("2027-01-15");
	});

	it("clamps Feb 29 yearly in non-leap years", () => {
		expect(advanceDate("2028-02-29", "yearly")).toBe("2029-02-28");
		expect(advanceDate("2026-06-10", "yearly")).toBe("2027-06-10");
	});
});
