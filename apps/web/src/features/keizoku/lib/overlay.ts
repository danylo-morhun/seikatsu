// Keizoku's offline overlay: server data + queued ops → what to show. Pure, so the page shows
// a change made offline right away and after a reload, until the server has it.

import type { KeizokuHabit } from "@/features/keizoku/actions/guard";
import type { DayCell, TodayHabit } from "@/features/keizoku/actions/logs";
import type { HabitPatch } from "@/features/keizoku/lib/keizoku-schemas";
import { mondayOf } from "@/features/keizoku/lib/streak";
import type { Op } from "@/features/pwa/lib/ops";

/** The day's done/note state after the queued ops for this habit, in order. */
function dayAfter(day: DayCell, habitId: string, ops: Op[]): DayCell {
	let cell = day;
	for (const op of ops) {
		if (!("habitId" in op.args) || op.args.habitId !== habitId) continue;
		if (!("date" in op.args) || op.args.date !== day.date) continue;
		if (op.name === "keizoku.checkDay") cell = { ...cell, done: true };
		if (op.name === "keizoku.uncheckDay")
			cell = { ...cell, done: false, note: null, photoUrl: null };
		if (op.name === "keizoku.saveDayNote") {
			const { note, removePhoto } = op.args as { note: string; removePhoto: boolean };
			cell = { ...cell, note: note.trim() || null, ...(removePhoto ? { photoUrl: null } : {}) };
		}
	}
	return cell;
}

function habitAfter(habit: KeizokuHabit, ops: Op[]): KeizokuHabit {
	let h = habit;
	for (const op of ops) {
		if (op.name !== "keizoku.updateHabit") continue;
		const { habitId, patch } = op.args as { habitId: string; patch: HabitPatch };
		if (habitId === habit.id) h = { ...h, ...(patch as Partial<KeizokuHabit>) };
	}
	return h;
}

/** Today's list with queued ticks, notes, edits and archives applied. */
export function overlayToday(list: TodayHabit[], ops: Op[], today: string): TodayHabit[] {
	if (ops.length === 0) return list;
	const archived = new Set<string>();
	for (const op of ops) {
		const id = (op.args as { habitId: string }).habitId;
		if (op.name === "keizoku.archiveHabit") archived.add(id);
		if (op.name === "keizoku.unarchiveHabit") archived.delete(id);
	}
	const monday = mondayOf(today);
	return list
		.filter((item) => !archived.has(item.habit.id))
		.map((item) => {
			const days = item.days.map((d) => dayAfter(d, item.habit.id, ops));
			// The week's count moves with ticks this week; the run waits for the server.
			const delta = days.reduce(
				(n, d, i) => n + (d.date >= monday ? Number(d.done) - Number(item.days[i].done) : 0),
				0,
			);
			return { ...item, habit: habitAfter(item.habit, ops), days, week: item.week + delta };
		});
}

/** One habit's done days (newest first) with queued ticks and notes applied. */
export function overlayDays(days: DayCell[], habitId: string, ops: Op[]): DayCell[] {
	if (ops.length === 0) return days;
	const byDate = new Map(days.map((d) => [d.date, d]));
	for (const op of ops) {
		const args = op.args as { habitId?: string; date?: string };
		if (args.habitId !== habitId || !args.date || byDate.has(args.date)) continue;
		byDate.set(args.date, { date: args.date, done: false, note: null, photoUrl: null });
	}
	return [...byDate.values()]
		.map((d) => dayAfter(d, habitId, ops))
		.filter((d) => d.done)
		.sort((a, b) => b.date.localeCompare(a.date));
}
