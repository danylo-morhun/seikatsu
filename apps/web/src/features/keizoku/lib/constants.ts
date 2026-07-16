export const FREQUENCY_TYPES = ["daily", "weekdays", "times_per_week"] as const;
export type FrequencyType = (typeof FREQUENCY_TYPES)[number];

export const TIME_OF_DAY_VALUES = ["morning", "anytime", "evening"] as const;
export type TimeOfDay = (typeof TIME_OF_DAY_VALUES)[number];

export const TIME_OF_DAY_LABELS: Record<TimeOfDay, string> = {
	morning: "Morning",
	anytime: "Anytime",
	evening: "Evening",
};

export const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export const FREQUENCY_LABELS: Record<FrequencyType, string> = {
	daily: "Every day",
	weekdays: "Specific days",
	times_per_week: "N times a week",
};

export const EMOJI_PRESETS = [
	"🏃",
	"💪",
	"📚",
	"💧",
	"🧘",
	"🥗",
	"😴",
	"✍️",
	"🎯",
	"🚭",
	"🧹",
	"🎸",
] as const;
