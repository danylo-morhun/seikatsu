import { describe, expect, it } from "vitest";
import { readVerdict, stateOf } from "./mail-verdict";

const candidates = [{ id: "a" }, { id: "b" }];

describe("readVerdict", () => {
	it("maps the number to an application", () => {
		const v = readVerdict(
			{
				match: "1",
				kind: "interview",
				confident: true,
				date: "2026-10-22",
				time: "09:00",
				summary: " Tech round ",
			},
			candidates,
		);
		expect(v).toEqual({
			applicationId: "b",
			kind: "interview",
			confident: true,
			date: "2026-10-22",
			time: "09:00",
			summary: "Tech round",
		});
		expect(stateOf(v)).toBe("applied");
	});

	it("drops what doesn't fit", () => {
		const v = readVerdict(
			{ match: "7", kind: "withdrawn", confident: "yes", date: "Thursday", time: "25:00" },
			candidates,
		);
		expect(v).toMatchObject({
			applicationId: null,
			kind: null,
			confident: false,
			date: null,
			time: null,
		});
		expect(stateOf(v)).toBe("skipped");
	});

	it("keeps a time only with a day", () => {
		expect(
			readVerdict({ match: "0", kind: "screening", time: "10:00" }, candidates).time,
		).toBeNull();
	});

	it("sends answers it can't place to review", () => {
		expect(
			stateOf(readVerdict({ match: "none", kind: "rejected", confident: true }, candidates)),
		).toBe("review");
		expect(stateOf(readVerdict({ match: "0", kind: "offer", confident: false }, candidates))).toBe(
			"review",
		);
	});
});
