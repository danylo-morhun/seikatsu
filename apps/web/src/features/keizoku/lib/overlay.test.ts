import type { KeizokuHabit } from "@/features/keizoku/actions/guard";
import type { DayCell, TodayHabit } from "@/features/keizoku/actions/logs";
import type { Op, OpName } from "@/features/pwa/lib/ops";
import { describe, expect, it } from "vitest";
import { overlayDays, overlayToday } from "./overlay";

const TODAY = "2026-10-28"; // a Wednesday; the week started Monday 26th

const habit = { id: "h1", name: "Run", emoji: "🏃" } as KeizokuHabit;
const cell = (date: string, done = false): DayCell => ({ date, done, note: null, photoUrl: null });

let n = 0;
function op<N extends OpName>(name: N, args: Op<N>["args"]): Op {
	return { opId: `op${n++}`, name, args, label: "", createdAt: n, status: "pending" } as Op;
}

function today(days: DayCell[], week: number): TodayHabit {
	return { habit, days, week, due: true, start: "2026-01-01" } as TodayHabit;
}

describe("overlayToday", () => {
	it("applies queued ticks in order and moves the week's count", () => {
		const list = [today([cell("2026-10-25"), cell("2026-10-27"), cell(TODAY)], 0)];
		const [item] = overlayToday(
			list,
			[
				op("keizoku.checkDay", { habitId: "h1", date: TODAY }),
				op("keizoku.checkDay", { habitId: "h1", date: "2026-10-25" }), // last week
				op("keizoku.checkDay", { habitId: "h1", date: "2026-10-27" }),
				op("keizoku.uncheckDay", { habitId: "h1", date: "2026-10-27" }),
			],
			TODAY,
		);
		expect(item.days.map((d) => d.done)).toEqual([true, false, true]);
		expect(item.week).toBe(1);
	});

	it("drops archived habits and shows edits", () => {
		const list = [today([cell(TODAY)], 0)];
		expect(overlayToday(list, [op("keizoku.archiveHabit", { habitId: "h1" })], TODAY)).toEqual([]);
		const [item] = overlayToday(
			list,
			[op("keizoku.updateHabit", { habitId: "h1", patch: { name: "Run 5k" } })],
			TODAY,
		);
		expect(item.habit.name).toBe("Run 5k");
	});

	it("keeps a note queued for a ticked day", () => {
		const [item] = overlayToday(
			[today([cell(TODAY, true)], 1)],
			[
				op("keizoku.saveDayNote", {
					habitId: "h1",
					date: TODAY,
					note: " 5 km ",
					removePhoto: false,
				}),
			],
			TODAY,
		);
		expect(item.days[0].note).toBe("5 km");
	});
});

describe("overlayDays", () => {
	it("adds and removes done days, newest first, for this habit only", () => {
		const days = [cell("2026-10-20", true)];
		const result = overlayDays(days, "h1", [
			op("keizoku.checkDay", { habitId: "h1", date: "2026-10-22" }),
			op("keizoku.checkDay", { habitId: "other", date: "2026-10-23" }),
			op("keizoku.uncheckDay", { habitId: "h1", date: "2026-10-20" }),
		]);
		expect(result.map((d) => d.date)).toEqual(["2026-10-22"]);
	});
});
