import { describe, expect, it } from "vitest";
import { applyFilters, readFilters, writeFilters } from "./filters";
import type { CardData } from "./types";

const card = (over: Partial<CardData>): CardData => ({
	id: "c",
	columnId: "col",
	projectId: "p",
	title: "t",
	description: null,
	priority: null,
	dueDate: null,
	position: "a0",
	checklistItems: [],
	labels: [],
	...over,
});

const none = { priorities: [], labelIds: [], due: "" as const };

describe("seiryu filters", () => {
	const today = "2026-10-11";

	it("due windows use the user's calendar day", () => {
		const cards = [
			card({ id: "late", dueDate: "2026-10-10" }),
			card({ id: "today", dueDate: today }),
			card({ id: "week", dueDate: "2026-10-18" }),
			card({ id: "later", dueDate: "2026-10-19" }),
			card({ id: "none" }),
		];
		const ids = (due: "overdue" | "today" | "week" | "none") =>
			applyFilters(cards, { ...none, due }, today).map((c) => c.id);
		expect(ids("overdue")).toEqual(["late"]);
		expect(ids("today")).toEqual(["today"]);
		expect(ids("week")).toEqual(["today", "week"]);
		expect(ids("none")).toEqual(["none"]);
	});

	it("priority and label filters combine with AND, values within one with OR", () => {
		const bug = { id: "l1", name: "bug", color: "#000000" };
		const cards = [
			card({ id: "a", priority: "high", labels: [bug] }),
			card({ id: "b", priority: "high" }),
			card({ id: "c", priority: "low", labels: [bug] }),
		];
		const out = applyFilters(
			cards,
			{ ...none, priorities: ["high", "urgent"], labelIds: ["l1"] },
			today,
		);
		expect(out.map((c) => c.id)).toEqual(["a"]);
	});

	it("round-trips through the URL and drops unknown due values", () => {
		const params = writeFilters(new URLSearchParams("x=1"), {
			priorities: ["low"],
			labelIds: ["a", "b"],
			due: "week",
		});
		expect(params.get("x")).toBe("1");
		expect(readFilters(params)).toEqual({ priorities: ["low"], labelIds: ["a", "b"], due: "week" });
		expect(readFilters(new URLSearchParams("due=soon")).due).toBe("");
	});
});
