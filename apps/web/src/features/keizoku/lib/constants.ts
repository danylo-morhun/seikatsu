export const FREQUENCY_TYPES = ["daily", "weekdays", "times_per_week"] as const;
export type FrequencyType = (typeof FREQUENCY_TYPES)[number];

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
