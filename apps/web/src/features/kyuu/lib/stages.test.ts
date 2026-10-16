import { describe, expect, it } from "vitest";
import { addDays, daysBetween, statusAfterEvent, waiting } from "./stages";

describe("statusAfterEvent", () => {
	it("moves forward on a screen or interview", () => {
		expect(statusAfterEvent("applied", "screening")).toBe("hr_screening");
		expect(statusAfterEvent("hr_screening", "interview")).toBe("technical_interview");
		expect(statusAfterEvent("drafted", "interview")).toBe("technical_interview");
	});

	it("never moves back on a later-booked screen", () => {
		expect(statusAfterEvent("technical_interview", "screening")).toBe("technical_interview");
		expect(statusAfterEvent("offer", "interview")).toBe("offer");
	});

	it("lands any answer that closes it", () => {
		expect(statusAfterEvent("offer", "rejected")).toBe("rejected");
		expect(statusAfterEvent("applied", "ghosted")).toBe("ghosted");
	});

	it("reopens a closed one when they come back", () => {
		expect(statusAfterEvent("ghosted", "screening")).toBe("hr_screening");
	});

	it("leaves the status alone on a follow-up", () => {
		expect(statusAfterEvent("applied", "follow_up")).toBe("applied");
	});
});

describe("days", () => {
	it("counts calendar days across a DST change", () => {
		expect(daysBetween("2026-03-28", "2026-03-30")).toBe(2);
		expect(daysBetween("2026-10-24", "2026-10-26")).toBe(2);
		expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
	});
});

describe("waiting", () => {
	const base = { status: "applied" as const, followedUpOn: null, answered: false };

	it("is quiet in the first week", () => {
		expect(waiting({ ...base, dateApplied: "2026-10-10" }, "2026-10-16")).toEqual({
			days: 6,
			due: null,
		});
	});

	it("asks for a follow-up after a week", () => {
		expect(waiting({ ...base, dateApplied: "2026-10-09" }, "2026-10-16")?.due).toBe("follow_up");
	});

	it("calls it ghosted after two weeks", () => {
		expect(waiting({ ...base, dateApplied: "2026-10-02" }, "2026-10-16")?.due).toBe("ghost");
	});

	it("restarts the clock after a follow-up", () => {
		const app = { ...base, dateApplied: "2026-10-01", followedUpOn: "2026-10-08" };
		expect(waiting(app, "2026-10-16")).toEqual({ days: 15, due: null });
		expect(waiting(app, "2026-10-22")?.due).toBe("ghost");
	});

	it("is null once answered or not sent", () => {
		expect(
			waiting({ ...base, answered: true, dateApplied: "2026-01-01" }, "2026-10-16"),
		).toBeNull();
		expect(
			waiting({ ...base, status: "drafted", dateApplied: "2026-01-01" }, "2026-10-16"),
		).toBeNull();
	});
});
