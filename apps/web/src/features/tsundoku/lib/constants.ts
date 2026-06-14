export const BOOK_STATUSES = ["want", "reading", "read", "dnf", "paused"] as const;
export type BookStatus = (typeof BOOK_STATUSES)[number];

export const STATUS_CONFIG: Record<
	BookStatus,
	{ label: string; short: string; className: string }
> = {
	want: {
		label: "Want to read",
		short: "Want",
		className: "bg-muted text-muted-foreground",
	},
	reading: {
		label: "Reading",
		short: "Reading",
		className: "bg-primary/15 text-primary",
	},
	read: {
		label: "Read",
		short: "Read",
		className: "bg-emerald-500/15 text-emerald-500",
	},
	dnf: {
		label: "Did not finish",
		short: "DNF",
		className: "bg-destructive/15 text-destructive",
	},
	paused: {
		label: "Paused",
		short: "Paused",
		className: "bg-amber-500/15 text-amber-500",
	},
};

export const RATING_MAX = 10;

export const GENRE_OPTIONS = [
	"Fiction",
	"Non-fiction",
	"Sci-fi",
	"Fantasy",
	"Mystery",
	"Thriller",
	"Romance",
	"Horror",
	"Biography",
	"History",
	"Philosophy",
	"Science",
	"Self-help",
	"Business",
	"Poetry",
	"Comics",
	"Other",
] as const;

export const SHELF_COLORS = [
	"#14b8a6",
	"#6366f1",
	"#f59e0b",
	"#ef4444",
	"#8b5cf6",
	"#ec4899",
	"#10b981",
	"#3b82f6",
] as const;
