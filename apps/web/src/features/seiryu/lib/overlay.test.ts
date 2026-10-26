import type { Op, OpName } from "@/features/pwa/lib/ops";
import { describe, expect, it } from "vitest";
import { overlayCards, overlayChecklist } from "./overlay";
import type { CardData } from "./types";

let n = 0;
function op<N extends OpName>(name: N, args: Op<N>["args"]): Op {
	return { opId: `op${n++}`, name, args, label: "", createdAt: n, status: "pending" } as Op;
}

const card = (id: string, columnId: string, position: string): CardData => ({
	id,
	columnId,
	projectId: "p",
	title: id,
	description: null,
	priority: null,
	dueDate: null,
	position,
	checklistItems: [],
	labels: [],
});

describe("overlayCards", () => {
	it("adds a queued card at the end of its column, once", () => {
		const create = op("seiryu.createCard", {
			id: "new",
			columnId: "todo",
			projectId: "p",
			title: "New",
		});
		const cards = overlayCards([card("a", "todo", "a0")], [create, create], "p");
		expect(cards.map((c) => c.id)).toEqual(["a", "new"]);
		expect(cards[1].position > "a0").toBe(true);
		expect(overlayCards([], [create], "other project")).toEqual([]);
	});

	it("moves, reorders, edits and archives in order", () => {
		const cards = overlayCards(
			[card("a", "todo", "a0"), card("b", "todo", "a1"), card("c", "todo", "a2")],
			[
				op("seiryu.moveCard", { cardId: "a", newColumnId: "done" }),
				op("seiryu.reorderCards", { cardId: "c", newPosition: "Zz" }),
				op("seiryu.updateCard", { cardId: "b", title: "Bee", priority: "high" }),
				op("seiryu.archiveCard", { cardId: "c" }),
			],
			"p",
		);
		expect(cards.map((c) => [c.id, c.columnId, c.title, c.priority])).toEqual([
			["a", "done", "a", null],
			["b", "todo", "Bee", "high"],
		]);
	});

	it("applies queued checklist changes to the card's items", () => {
		const [c] = overlayCards(
			[
				{
					...card("a", "todo", "a0"),
					checklistItems: [{ id: "i1", title: "One", isCompleted: false, position: "a0" }],
				},
			],
			[
				op("seiryu.toggleChecklistItem", { itemId: "i1", isCompleted: true }),
				op("seiryu.createChecklistItem", { id: "i2", cardId: "a", title: "Two" }),
			],
			"p",
		);
		expect(c.checklistItems.map((i) => [i.id, i.isCompleted])).toEqual([
			["i1", true],
			["i2", false],
		]);
	});
});

describe("overlayChecklist", () => {
	it("re-applying what the section already shows changes nothing", () => {
		const items = [{ id: "i1", title: "One", isCompleted: true, position: "a0" }];
		const ops = [
			op("seiryu.createChecklistItem", { id: "i1", cardId: "a", title: "One" }),
			op("seiryu.toggleChecklistItem", { itemId: "i1", isCompleted: true }),
		];
		expect(overlayChecklist("a", items, ops)).toEqual(items);
		expect(
			overlayChecklist("a", items, [op("seiryu.deleteChecklistItem", { itemId: "i1" })]),
		).toEqual([]);
	});
});
