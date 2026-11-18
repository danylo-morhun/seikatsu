import { describe, expect, it } from "vitest";
import {
	focusCandidates,
	lookBack,
	mondayOf,
	planTarget,
	projectOfHref,
	weekPhase,
} from "./rhythm";

const pick = (key: string) => ({ key, title: key, href: "/", app: "/seiryu" });

describe("planTarget", () => {
	it("plans this week, and on Sunday evening the next", () => {
		expect(mondayOf("2026-11-18")).toBe("2026-11-16");
		expect(mondayOf("2026-11-22")).toBe("2026-11-16");
		expect(planTarget("2026-11-18", 600)).toBe("2026-11-16");
		expect(planTarget("2026-11-22", 600)).toBe("2026-11-16");
		expect(planTarget("2026-11-22", 19 * 60)).toBe("2026-11-23");
		expect(planTarget("2026-11-22", 19 * 60, "21:00")).toBe("2026-11-16");
	});

	it("asks to plan until the week is planned", () => {
		expect(weekPhase(null)).toBe("plan");
		expect(weekPhase({ plannedAt: new Date() })).toBe("week");
	});
});

describe("focusCandidates", () => {
	it("offers leftovers, then goals' steps, then cards under way, each once", () => {
		const out = focusCandidates({
			carried: [pick("a")],
			goalSteps: [{ ...pick("b"), goal: "Tatry", note: "Next step" }],
			doing: [
				{ ...pick("b"), note: "In progress", goal: "Tatry" },
				{ ...pick("c"), note: "In progress", goal: null },
			],
			soon: [{ ...pick("a"), note: "Due Fri", goal: null }],
		});
		expect(out.map((c) => [c.key, c.from, c.goal])).toEqual([
			["a", "carried", null],
			["b", "goal", "Tatry"],
			["c", "doing", null],
		]);
	});
});

describe("lookBack", () => {
	it("counts planned and closed days and the picks done", () => {
		const d = new Date();
		expect(
			lookBack([
				{ plannedAt: d, closedAt: d, result: { done: 2, of: 3 } },
				{ plannedAt: d, closedAt: null, result: null },
				{ plannedAt: null, closedAt: d, result: { done: 0, of: 0 } },
			]),
		).toEqual({ planned: 2, closed: 2, done: 2, of: 3 });
	});
});

describe("projectOfHref", () => {
	it("reads the project from a card's link", () => {
		const id = "9f593b2a-3ccf-4ba9-bbec-e8462cf0f883";
		expect(projectOfHref(`/seiryu/${id}/x`)).toBe(id);
		expect(projectOfHref("/kuroji")).toBeNull();
	});
});
