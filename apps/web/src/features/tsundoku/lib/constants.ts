export const BOOK_STATUSES = ["want", "reading", "read", "dnf", "paused"] as const;
export type BookStatus = (typeof BOOK_STATUSES)[number];

/** Statuses read by their words, never by colour; the key sets it on a book (book keys). */
export const STATUS_CONFIG: Record<BookStatus, { label: string; short: string; key?: string }> = {
	want: { label: "On the pile", short: "Pile", key: "P" },
	reading: { label: "Reading", short: "Reading", key: "R" },
	paused: { label: "Paused", short: "Paused" },
	read: { label: "Read", short: "Read", key: "D" },
	dnf: { label: "Didn't finish", short: "Didn't finish" },
};

/** The library's three piles. Paused books stay with Reading; unfinished ones with Read. */
export const SEGMENTS = [
	{ value: "reading", label: "Reading", statuses: ["reading", "paused"] },
	{ value: "pile", label: "Pile", statuses: ["want"] },
	{ value: "read", label: "Read", statuses: ["read", "dnf"] },
] as const satisfies readonly { value: string; label: string; statuses: readonly BookStatus[] }[];
export type Segment = (typeof SEGMENTS)[number]["value"];

/** Stored 1–10; shown as five stars in halves. */
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
export type Genre = (typeof GENRE_OPTIONS)[number];
