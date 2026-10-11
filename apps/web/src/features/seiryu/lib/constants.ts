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

/**
 * Label and column marks, mixed from the shell's pigments (DESIGN.md) at one lightness so no
 * mark shouts over another. Stored as hex; any older hex keeps working.
 */
export const LABEL_COLORS = [
	{ name: "Shu", hex: "#e87b62" },
	{ name: "Kin", hex: "#deb866" },
	{ name: "Midori", hex: "#76be86" },
	{ name: "Seiji", hex: "#75c2b3" },
	{ name: "Ruri", hex: "#69a1e8" },
	{ name: "Murasaki", hex: "#c18ed1" },
	{ name: "Sakura", hex: "#e199af" },
	{ name: "Sumi", hex: "#9d9790" },
] as const;

/** A column named "Done" holds finished cards; they don't count as open work. */
export const isDoneColumn = (name: string) => name.trim().toLowerCase() === "done";
