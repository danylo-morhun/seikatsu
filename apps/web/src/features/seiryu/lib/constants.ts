export const DEFAULT_COLUMNS = ["Todo", "In Progress", "Done"] as const;

export type Priority = "low" | "medium" | "high" | "urgent";

/** `level` fills that many of four signal bars: priority reads by scale, never by colour. */
export const PRIORITY_CONFIG: Record<Priority, { label: string; level: number }> = {
	low: { label: "Low", level: 1 },
	medium: { label: "Medium", level: 2 },
	high: { label: "High", level: 3 },
	urgent: { label: "Urgent", level: 4 },
};

export const PRIORITIES = Object.keys(PRIORITY_CONFIG) as Priority[];

/** The default column that starts as the finish line. */
export const DEFAULT_DONE_COLUMN: (typeof DEFAULT_COLUMNS)[number] = "Done";
