import { z } from "zod";
import {
	checkDay,
	getHabitDays,
	getTodayHabits,
	saveDayNote,
	uncheckDay,
} from "@/features/keizoku/actions/logs";
import { getYearStats } from "@/features/keizoku/actions/stats";
import { addDays } from "@/features/keizoku/lib/streak";
import { day } from "./shell";
import { tool } from "./types";

const id = z.uuid();

export const keizokuTools = [
	tool({
		name: "keizoku_habits",
		title: "Keizoku habits",
		description:
			"Active habits with ids: schedule, time of day, whether due today, current streak, this week's count, and the last 7 days (done + note).",
		input: {},
		run: async (_a, { today }) =>
			(await getTodayHabits(today)).map((h) => ({
				id: h.habit.id,
				name: h.habit.name,
				timeOfDay: h.habit.timeOfDay,
				emoji: h.habit.emoji,
				frequency: h.habit.frequencyType,
				days: h.habit.frequencyDays,
				target: h.habit.frequencyTarget,
				requiresPhoto: h.habit.requiresPhoto || undefined,
				followsReading: h.habit.fromReading || undefined,
				dueToday: h.due,
				streak: h.streak,
				thisWeek: h.week,
				last7: h.days.map((d) => ({ date: d.date, done: d.done, note: d.note })),
			})),
	}),
	tool({
		name: "keizoku_history",
		title: "Keizoku habit history",
		description:
			"Days a habit was done between `from` and `to` (default the last 90 days), with notes.",
		input: { habitId: id, from: day.optional(), to: day.optional() },
		run: async ({ habitId, from, to }, { today }) =>
			(await getHabitDays(habitId, from ?? addDays(today, -89), to ?? today))
				.filter((d) => d.done)
				.map((d) => ({ date: d.date, note: d.note })),
	}),
	tool({
		name: "keizoku_year",
		title: "Keizoku year",
		description: "A year of habits: check-ins, full days, rate, best runs, per-habit figures.",
		input: { year: z.number().int().min(2000).max(3000).optional() },
		run: async ({ year }, { today }) => {
			// The heatmap's 365 days say nothing a model needs; the figures do.
			const { days: _days, ...stats } = await getYearStats(
				year ?? Number(today.slice(0, 4)),
				today,
			);
			return stats;
		},
	}),
	tool({
		name: "keizoku_tick",
		title: "Tick a habit",
		description:
			"Mark a habit done on a day (default today; past days allowed, never future), optionally with a note. `done: false` clears the day (and its note).",
		input: {
			habitId: id,
			date: day.optional(),
			done: z.boolean().default(true),
			note: z.string().max(2000).optional(),
		},
		write: true,
		idempotent: true,
		run: async ({ habitId, date, done, note }, { today }) => {
			const on = date ?? today;
			if (on > today) return { error: "Can't tick a day still to come" };
			if (!done) return uncheckDay(habitId, on);
			const ticked = await checkDay(habitId, on);
			if ("error" in ticked || note === undefined) return ticked;
			const form = new FormData();
			form.set("habitId", habitId);
			form.set("date", on);
			form.set("note", note);
			return saveDayNote(form);
		},
	}),
];
