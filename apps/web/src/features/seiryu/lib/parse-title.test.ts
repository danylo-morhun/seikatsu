import { describe, expect, it } from "vitest";
import { parseTitle } from "./parse-title";

const groups = [
	{ id: "g-bw", name: "BW" },
	{ id: "g-xmas", name: "Black Week" },
];
const labels = [
	{ id: "l-aisha", name: "Aisha" },
	{ id: "l-bug", name: "Bug" },
];
const p = (text: string) => parseTitle(text, { groups, labels });

describe("parseTitle", () => {
	it("reads a leading group name and drops it", () => {
		expect(p("BW: final price list")).toEqual({
			title: "final price list",
			groupId: "g-bw",
			labelIds: [],
			priority: null,
		});
		expect(p("bw: final price list").groupId).toBe("g-bw");
	});

	it("reads a leading label name when no group has it", () => {
		expect(p("Aisha: date filter")).toMatchObject({ title: "date filter", labelIds: ["l-aisha"] });
	});

	it("keeps an unknown prefix in the title", () => {
		expect(p("Weekly: marketing numbers")).toMatchObject({
			title: "Weekly: marketing numbers",
			groupId: null,
		});
		expect(p("Fri 20.11: post starter pack").title).toBe("Fri 20.11: post starter pack");
	});

	it("reads #tags for groups and labels, spaces folded", () => {
		expect(p("prices ready #black-week #bug")).toEqual({
			title: "prices ready",
			groupId: "g-xmas",
			labelIds: ["l-bug"],
			priority: null,
		});
		expect(p("fix #unknown thing")).toMatchObject({ title: "fix #unknown thing", labelIds: [] });
	});

	it("reads priority as !1–!4 or by name", () => {
		expect(p("call bank !4").priority).toBe("urgent");
		expect(p("call bank !high").priority).toBe("high");
		expect(p("Launch!").priority).toBeNull();
		expect(p("call bank !9")).toMatchObject({ title: "call bank !9", priority: null });
	});

	it("keeps the text when only tags are left", () => {
		expect(p("#bug")).toEqual({ title: "#bug", groupId: null, labelIds: [], priority: null });
	});
});
