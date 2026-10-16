import { describe, expect, it } from "vitest";
import { type StatApp, type StatEvent, computeStats } from "./stats";

const app = (id: string, over: Partial<StatApp> = {}): StatApp => ({
	id,
	status: "applied",
	source: "Djinni",
	applyMethod: "manual",
	dateApplied: "2026-10-01",
	...over,
});

describe("computeStats", () => {
	it("leaves unsent applications out of every rate", () => {
		const s = computeStats(
			[app("a"), app("b", { status: "drafted" }), app("c", { status: "sourced" })],
			[],
			"2026-10-05",
		);
		expect(s.sent).toBe(1);
		expect(s.replyRate).toBe(0);
	});

	it("counts a rejection as an answer, not as an interview", () => {
		const s = computeStats(
			[app("a", { status: "rejected" }), app("b")],
			[{ applicationId: "a", kind: "rejected", date: "2026-10-04" }],
			"2026-10-05",
		);
		expect(s.answered).toBe(1);
		expect(s.replyRate).toBe(0.5);
		expect(s.interviewRate).toBe(0);
		expect(s.stops[0]).toEqual({ label: "Before any answer", count: 1 });
	});

	it("reads the furthest stage from events and status alike", () => {
		const events: StatEvent[] = [
			{ applicationId: "a", kind: "screening", date: null },
			{ applicationId: "a", kind: "rejected", date: null },
		];
		const s = computeStats(
			[app("a", { status: "rejected" }), app("b", { status: "technical_interview" })],
			events,
			"2026-10-05",
		);
		expect(s.funnel.map((f) => f.count)).toEqual([2, 2, 2, 1, 0]);
		expect(s.stops[1]).toEqual({ label: "After a screening", count: 1 });
		expect(s.inProgress).toBe(1);
	});

	it("takes the median days to a first answer, known days only", () => {
		const s = computeStats(
			[app("a"), app("b"), app("c"), app("d", { status: "rejected" })],
			[
				{ applicationId: "a", kind: "screening", date: "2026-10-03" },
				{ applicationId: "a", kind: "interview", date: "2026-10-20" },
				{ applicationId: "b", kind: "rejected", date: "2026-10-11" },
				{ applicationId: "d", kind: "rejected", date: null },
			],
			"2026-10-30",
		);
		expect(s.firstAnswer).toEqual({ median: 6, n: 2 });
	});

	it("compares auto against manual", () => {
		const s = computeStats(
			[
				app("a", { applyMethod: "auto" }),
				app("b", { applyMethod: "auto", status: "hr_screening" }),
			],
			[],
			"2026-10-05",
		);
		expect(s.methods.auto).toEqual({ sent: 2, answered: 1, rate: 0.5 });
		expect(s.methods.manual.rate).toBeNull();
	});

	it("keeps empty weeks in the weekly series", () => {
		const s = computeStats(
			[app("a", { dateApplied: "2026-09-01" }), app("b", { dateApplied: "2026-09-24" })],
			[],
			"2026-10-05",
		);
		expect(s.weekly).toEqual([
			{ week: "2026-08-31", count: 1 },
			{ week: "2026-09-07", count: 0 },
			{ week: "2026-09-14", count: 0 },
			{ week: "2026-09-21", count: 1 },
		]);
	});

	it("counts the ones waiting for an answer", () => {
		const s = computeStats(
			[app("a"), app("b", { status: "ghosted" }), app("c", { status: "hr_screening" })],
			[],
			"2026-10-05",
		);
		expect(s.waiting).toBe(1);
		expect(s.closed.ghosted).toBe(1);
	});
});
