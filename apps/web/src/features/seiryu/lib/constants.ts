export const DEFAULT_COLUMNS = ["Todo", "In Progress", "Done"] as const;

export const PRIORITY_CONFIG = {
	low: { label: "Low", color: "bg-blue-500" },
	medium: { label: "Medium", color: "bg-yellow-500" },
	high: { label: "High", color: "bg-orange-500" },
	urgent: { label: "Urgent", color: "bg-red-500" },
} as const;

export const LABEL_COLORS = [
	"#ef4444",
	"#f97316",
	"#eab308",
	"#22c55e",
	"#06b6d4",
	"#6366f1",
	"#a855f7",
	"#ec4899",
	"#64748b",
] as const;
