import type { HabitSchedule } from "./streak";

export const FREQUENCY_TYPES = ["daily", "weekdays", "times_per_week"] as const;
export type FrequencyType = (typeof FREQUENCY_TYPES)[number];

export const FREQUENCY_LABELS: Record<FrequencyType, string> = {
	daily: "Every day",
	weekdays: "On days",
	times_per_week: "Times a week",
};

/** The day's order on Today: morning first. Only an order — the list has no sections. */
export const TIME_OF_DAY_VALUES = ["morning", "anytime", "evening"] as const;
export type TimeOfDay = (typeof TIME_OF_DAY_VALUES)[number];

export const TIME_OF_DAY_LABELS: Record<TimeOfDay, string> = {
	morning: "Morning",
	anytime: "Any time",
	evening: "Evening",
};

/** Indexed as `frequencyDays` stores them: 0 = Sunday. */
export const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
/** The week as the picker shows it, Monday first. */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

/** 13 icons and a field for any other: two even rows of seven in the dialog. */
export const EMOJI_PRESETS = [
	"💧",
	"💪",
	"🏃",
	"🧘",
	"📚",
	"✍️",
	"💻",
	"🥗",
	"💊",
	"😴",
	"🧹",
	"🎸",
	"🎯",
] as const;

/** "Every day", "Mon, Wed, Fri", "3 times a week". */
export function scheduleLabel(habit: HabitSchedule): string {
	if (habit.frequencyType === "weekdays" && habit.frequencyDays?.length) {
		if (habit.frequencyDays.length === 7) return "Every day";
		return WEEK_ORDER.filter((d) => habit.frequencyDays?.includes(d))
			.map((d) => DAY_NAMES[d])
			.join(", ");
	}
	if (habit.frequencyType === "times_per_week") {
		const n = habit.frequencyTarget ?? 1;
		return n === 1 ? "Once a week" : `${n} times a week`;
	}
	return "Every day";
}

const DAY = new Intl.DateTimeFormat("en", {
	weekday: "short",
	month: "short",
	day: "numeric",
	timeZone: "UTC",
});

/** "Thu, Oct 15" for a YYYY-MM-DD day. */
export function formatDay(date: string) {
	return DAY.format(new Date(`${date}T00:00:00Z`));
}

/** A day of every habit, as the map reads it out. */
export function activityText(day: { date: string; done: number; due: number }) {
	return `${formatDay(day.date)} · ${day.due === 0 ? "nothing due" : `${day.done} of ${day.due} done`}`;
}
