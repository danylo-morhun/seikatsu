import { describe, expect, it } from "vitest";
import { flowRows, monthsBetween } from "./monthly-flow";

describe("monthsBetween", () => {
	it("lists months across a year boundary", () => {
		expect(monthsBetween("2025-11", "2026-02")).toEqual([
			"2025-11",
			"2025-12",
			"2026-01",
			"2026-02",
		]);
	});
});

describe("flowRows", () => {
	const m = (month: string, income: number, expenses: number) => ({ month, income, expenses });

	it("lists months newest first and keeps a single empty month", () => {
		const rows = flowRows([m("2026-08", 10, 5), m("2026-10", 1, 0)], "2026-08", "2026-10");
		expect(rows.map((r) => (r.kind === "month" ? r.month : "gap"))).toEqual([
			"2026-10",
			"2026-09",
			"2026-08",
		]);
	});

	it("folds a run of empty months into one gap row", () => {
		const rows = flowRows([m("2025-02", 1, 1), m("2025-07", 2, 2)], "2025-01", "2025-08");
		expect(rows).toEqual([
			{ kind: "month", month: "2025-08", income: 0, expenses: 0 },
			{ kind: "month", month: "2025-07", income: 2, expenses: 2 },
			{ kind: "gap", from: "2025-03", to: "2025-06" },
			{ kind: "month", month: "2025-02", income: 1, expenses: 1 },
			{ kind: "month", month: "2025-01", income: 0, expenses: 0 },
		]);
	});

	it("keeps a decades-long empty range to a single row", () => {
		expect(flowRows([], "1990-01", "2026-10")).toEqual([
			{ kind: "gap", from: "1990-01", to: "2026-10" },
		]);
	});

	it("treats a month with zero totals as empty", () => {
		expect(flowRows([m("2026-01", 0, 0)], "2026-01", "2026-02")).toEqual([
			{ kind: "gap", from: "2026-01", to: "2026-02" },
		]);
	});
});
