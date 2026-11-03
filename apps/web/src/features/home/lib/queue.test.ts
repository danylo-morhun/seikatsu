import { describe, expect, it } from "vitest";
import { buildQueue, type QueueData } from "./queue";

const TODAY = "2026-11-03";

const empty: QueueData = { captures: null, wants: null, cards: null, jobs: null, car: null };

const card = (id: string, dueDate: string, doneColumnId: string | null = "col-done") => ({
	id,
	title: `Card ${id}`,
	dueDate,
	projectId: "p",
	projectName: "Home",
	doneColumnId,
});

const wants = (n: number) => ({
	decide: n,
	toDecide: Array.from({ length: n }, (_, i) => ({ id: `w${i}`, title: `Want ${i}` })),
	canBuy: 0,
	nextBuy: null,
	plan: 0,
	cooling: 0,
	total: n,
});

describe("buildQueue", () => {
	it("is empty when nothing waits", () => {
		expect(buildQueue(empty, TODAY)).toEqual([]);
	});

	it("puts overdue first, then due, then the rest", () => {
		const queue = buildQueue(
			{
				...empty,
				cards: [card("today", TODAY), card("late", "2026-11-01")],
				jobs: { toSend: 0, waiting: 0, ghostDue: 2, ghostIds: ["a", "b"], active: 0, total: 2 },
				captures: 1,
			},
			TODAY,
		);
		expect(queue.map((q) => q.key)).toEqual([
			"seiryu:late",
			"seiryu:today",
			"kuroji:captures",
			"kyuu:ghost",
		]);
		expect(queue[0].note).toBe("Home · 2 days overdue");
		expect(queue[3].act).toEqual({ kind: "ghost", ids: ["a", "b"] });
	});

	it("marks a card done only when its project has a finish column", () => {
		const [withDone, without] = buildQueue(
			{ ...empty, cards: [card("a", TODAY), card("b", TODAY, null)] },
			TODAY,
		);
		expect(withDone.act).toEqual({ kind: "done", cardId: "a", columnId: "col-done" });
		expect(without.act).toEqual({ kind: "open" });
	});

	it("gives a few cooled wants a row each, and folds many into one", () => {
		expect(buildQueue({ ...empty, wants: wants(2) }, TODAY).map((q) => q.act.kind)).toEqual([
			"decide",
			"decide",
		]);
		const [many] = buildQueue({ ...empty, wants: wants(5) }, TODAY);
		expect(many).toMatchObject({ title: "5 wants to decide", act: { kind: "open" } });
	});

	it("shows the car only when its next service is close", () => {
		const car = (status: "ok" | "soon" | "overdue") => ({
			vehicleId: "v",
			name: "Hyundai i30",
			currentKm: 84_000,
			next: { name: "Tyres", status, kmLeft: -1200, daysLeft: null },
		});
		expect(buildQueue({ ...empty, car: car("ok") }, TODAY)).toEqual([]);
		const [late] = buildQueue({ ...empty, car: car("overdue") }, TODAY);
		expect(late).toMatchObject({ tone: "overdue", note: "Hyundai i30 · 1,200 km overdue" });
	});
});
