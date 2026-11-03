import { describe, expect, it } from "vitest";
import { describeLink, goalProgress, type LinkReading, timeLeft } from "./progress";

const money = (n: number, c: string) => `${n} ${c}`;
const view = (r: LinkReading) => describeLink(r, money);

describe("describeLink", () => {
	it("reads a fund against its target", () => {
		expect(
			view({ kind: "fund", name: "Tatry", balance: 1240, currency: "PLN", target: 3000 }),
		).toMatchObject({ detail: "1240 PLN of 3000 PLN", ratio: 1240 / 3000 });
		expect(
			view({ kind: "fund", name: "Tatry", balance: 4000, currency: "PLN", target: 3000 }).ratio,
		).toBe(1);
		expect(
			view({ kind: "fund", name: "Rainy day", balance: 500, currency: "PLN", target: null }),
		).toMatchObject({ detail: "500 PLN saved", ratio: null });
	});

	it("counts a project's cards and a shelf's books", () => {
		expect(
			view({ kind: "project", name: "Trip", done: 3, total: 7, projectId: "p" }),
		).toMatchObject({ detail: "3 of 7 cards done", href: "/seiryu/p" });
		expect(view({ kind: "shelf", name: "2027", finished: 0, total: 0 })).toMatchObject({
			detail: "No books yet",
			ratio: null,
		});
	});

	it("keeps a habit's share over four weeks", () => {
		expect(view({ kind: "habit", name: "Gym", emoji: "💪", done: 9, expected: 12 })).toMatchObject({
			title: "💪 Gym",
			detail: "75% over 4 weeks",
			ratio: 0.75,
		});
	});

	it("says when a linked container is gone", () => {
		expect(view({ kind: "missing", was: "project" })).toMatchObject({
			app: "/seiryu",
			ratio: null,
		});
	});
});

describe("goalProgress", () => {
	it("averages only the links with a finish line", () => {
		const views = [
			view({ kind: "fund", name: "Tatry", balance: 1500, currency: "PLN", target: 3000 }),
			view({ kind: "project", name: "Trip", done: 1, total: 1, projectId: "p" }),
			view({ kind: "jobs", sent: 4, answered: 1, active: 2 }),
		];
		expect(goalProgress(views)).toBe(0.75);
		expect(goalProgress([views[2]])).toBeNull();
	});
});

describe("timeLeft", () => {
	it("speaks in days, then months, then years", () => {
		expect(timeLeft("2026-11-03", "2026-11-03")).toBe("today");
		expect(timeLeft("2026-11-15", "2026-11-03")).toBe("in 12 days");
		expect(timeLeft("2027-02-14", "2026-11-03")).toBe("in 3 months");
		expect(timeLeft("2026-10-29", "2026-11-03")).toBe("5 days over");
	});
});
