import { describe, expect, it } from "vitest";
import { buildQueue } from "./queue";

const today = "2026-11-03";

describe("buildQueue", () => {
	it("is empty when nothing waits", () => {
		expect(buildQueue("money", {}, today)).toEqual([]);
		expect(buildQueue("do", { habits: { habits: [] }, cards: [] }, today)).toEqual([]);
		expect(buildQueue("life", { reading: null }, today)).toEqual([]);
	});

	it("puts overdue before due today before the rest", () => {
		const queue = buildQueue(
			"do",
			{
				cards: [
					{ id: "c1", title: "Today", dueDate: today, projectId: "p", projectName: "Home" },
					{ id: "c2", title: "Late", dueDate: "2026-11-01", projectId: "p", projectName: "Home" },
				],
				habits: {
					habits: [
						{ id: "h1", name: "Gym", emoji: "", done: false },
						{ id: "h2", name: "Read", emoji: "", done: true },
					],
				},
				jobs: { toSend: 0, waiting: 0, ghostDue: 2, active: 0, total: 0 },
				car: {
					vehicleId: "v",
					name: "Mazda 3",
					currentKm: 1,
					next: { name: "Tyre swap", status: "overdue", kmLeft: null, daysLeft: -2 },
				},
			},
			today,
		);
		expect(queue.map((i) => i.key)).toEqual([
			"seiryu:c2",
			"aisha:next",
			"seiryu:c1",
			"keizoku:left",
			"kyuu:ghost",
		]);
		expect(queue[0]).toMatchObject({ note: "Home · 2 days overdue", href: "/seiryu/p/c2" });
		expect(queue.find((i) => i.key === "keizoku:left")?.note).toBe("Gym");
		expect(queue.find((i) => i.key === "aisha:next")?.note).toBe("Mazda 3 · 2 days overdue");
	});

	it("skips a car with nothing close", () => {
		const car = {
			vehicleId: "v",
			name: "Mazda 3",
			currentKm: 1,
			next: { name: "Oil", status: "ok" as const, kmLeft: 5000, daysLeft: null },
		};
		expect(buildQueue("do", { car }, today)).toEqual([]);
	});

	it("lists money waiting on a decision", () => {
		const queue = buildQueue(
			"money",
			{
				captures: 1,
				wants: { decide: 2, canBuy: 1, nextBuy: "Lamp", plan: 3, cooling: 0, total: 5 },
			},
			today,
		);
		expect(queue.map((i) => i.title)).toEqual([
			"1 payment to add",
			"2 wants to decide",
			"Can buy Lamp",
		]);
	});
});
