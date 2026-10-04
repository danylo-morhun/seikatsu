import { describe, expect, it } from "vitest";
import { addMonths, compareUrgency, documentDue, kmPerDay, maintenanceDue } from "./due";

const base = {
	intervalKm: 10_000,
	intervalMonths: 12,
	lastDone: { date: "2026-01-10", km: 160_000 },
	today: "2026-06-10",
	kmPerDay: null,
};

describe("maintenanceDue", () => {
	it("is unknown when never done", () => {
		const due = maintenanceDue({ ...base, lastDone: null, currentKm: 160_000 });
		expect(due.status).toBe("unknown");
	});

	it("is ok well within both limits", () => {
		const due = maintenanceDue({ ...base, currentKm: 163_000 });
		expect(due).toMatchObject({
			status: "ok",
			dueKm: 170_000,
			kmLeft: 7_000,
			dueDate: "2027-01-10",
		});
	});

	it("is soon when km limit is close, even if time is fine", () => {
		expect(maintenanceDue({ ...base, currentKm: 169_200 }).status).toBe("soon");
	});

	it("is soon when time limit is close, even if km is fine", () => {
		expect(maintenanceDue({ ...base, currentKm: 161_000, today: "2026-12-20" }).status).toBe(
			"soon",
		);
	});

	it("is overdue when either limit has passed", () => {
		expect(maintenanceDue({ ...base, currentKm: 170_500 }).status).toBe("overdue");
		expect(maintenanceDue({ ...base, currentKm: 161_000, today: "2027-02-01" }).status).toBe(
			"overdue",
		);
	});

	it("handles time-only items", () => {
		const due = maintenanceDue({ ...base, intervalKm: null, currentKm: 999_999 });
		expect(due.kmLeft).toBeNull();
		expect(due.status).toBe("ok");
	});

	it("estimates the earlier of km pace and time limit", () => {
		// 7,000 km left at 50 km/day = 140 days → 2026-10-28, earlier than 2027-01-10.
		const due = maintenanceDue({ ...base, currentKm: 163_000, kmPerDay: 50 });
		expect(due.estimatedDate).toBe("2026-10-28");
		// Slow driver: time limit wins.
		const slow = maintenanceDue({ ...base, currentKm: 163_000, kmPerDay: 5 });
		expect(slow.estimatedDate).toBe("2027-01-10");
	});
});

describe("kmPerDay", () => {
	it("needs at least two readings a week apart", () => {
		expect(kmPerDay([{ date: "2026-01-01", km: 1000 }])).toBeNull();
		expect(
			kmPerDay([
				{ date: "2026-01-01", km: 1000 },
				{ date: "2026-01-03", km: 1200 },
			]),
		).toBeNull();
	});

	it("averages over the span regardless of input order", () => {
		expect(
			kmPerDay([
				{ date: "2026-01-11", km: 1500 },
				{ date: "2026-01-01", km: 1000 },
			]),
		).toBe(50);
	});

	it("ignores readings older than the window", () => {
		const pace = kmPerDay(
			[
				{ date: "2024-01-01", km: 0 },
				{ date: "2026-01-01", km: 10_000 },
				{ date: "2026-01-11", km: 10_500 },
			],
			30,
		);
		expect(pace).toBe(50);
	});
});

describe("addMonths", () => {
	it("clamps to month end", () => {
		expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
		expect(addMonths("2027-11-15", 3)).toBe("2028-02-15");
	});
});

describe("documentDue", () => {
	it("flags documents expiring within 30 days", () => {
		expect(documentDue("2026-07-01", "2026-06-10").status).toBe("soon");
		expect(documentDue("2026-06-10", "2026-06-10").status).toBe("overdue");
		expect(documentDue("2026-12-01", "2026-06-10").status).toBe("ok");
	});
});

describe("compareUrgency", () => {
	it("sorts overdue, soon, unknown, ok, then by date", () => {
		const items = [
			{ id: "ok-late", status: "ok" as const, estimatedDate: "2027-05-01" },
			{ id: "unknown", status: "unknown" as const, estimatedDate: null },
			{ id: "ok-early", status: "ok" as const, estimatedDate: "2026-12-01" },
			{ id: "overdue", status: "overdue" as const, estimatedDate: "2026-01-01" },
			{ id: "soon", status: "soon" as const, estimatedDate: "2026-07-01" },
		];
		expect(items.sort(compareUrgency).map((i) => i.id)).toEqual([
			"overdue",
			"soon",
			"unknown",
			"ok-early",
			"ok-late",
		]);
	});
});
