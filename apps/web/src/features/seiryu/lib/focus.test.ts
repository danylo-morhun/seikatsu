import { describe, expect, it } from "vitest";
import { buildFocus, type FocusCard } from "./focus";

const TODAY = "2026-11-17";
const card = (id: string, over: Partial<FocusCard> = {}): FocusCard => ({
	id,
	title: id,
	projectId: "p",
	projectName: "P",
	projectColor: null,
	columnId: "todo",
	started: false,
	position: "a0",
	groupName: null,
	priority: null,
	dueDate: null,
	dueTime: null,
	startOn: null,
	waitingOn: null,
	repeats: false,
	movedAt: "2026-11-10T00:00:00.000Z",
	checklist: null,
	doneColumnId: "done",
	...over,
});

describe("buildFocus", () => {
	it("puts each card in its first section and leaves the rest out", () => {
		const sections = buildFocus(
			[
				card("late", { dueDate: "2026-11-15" }),
				card("now", { dueDate: TODAY }),
				card("started", { started: true }),
				card("startedLate", { started: true, dueDate: "2026-11-16" }),
				card("soon", { dueDate: "2026-11-20" }),
				card("later", { dueDate: "2026-12-20" }),
				card("someday"),
				card("hidden", { started: true, startOn: "2026-11-23" }),
				card("waiting", { started: true, waitingOn: "Xylem sync" }),
				card("hiddenButDue", { dueDate: TODAY, startOn: "2026-11-23" }),
			],
			TODAY,
		);
		expect(sections.map((s) => [s.key, s.cards.map((c) => c.id)])).toEqual([
			["overdue", ["late", "startedLate"]],
			["today", ["now", "hiddenButDue"]],
			["doing", ["started"]],
			["soon", ["soon"]],
		]);
	});

	it("orders by date, time, then priority", () => {
		const [today] = buildFocus(
			[
				card("low", { dueDate: TODAY, priority: "low" }),
				card("urgent", { dueDate: TODAY, priority: "urgent" }),
				card("early", { dueDate: TODAY, dueTime: "09:00" }),
			],
			TODAY,
		);
		expect(today?.cards.map((c) => c.id)).toEqual(["early", "urgent", "low"]);
	});
});
