// Kyuu's model of progress: one status per application, and the events that say what happened
// and when. Pure rules; the actions and the views share them.

export const STATUSES = [
	"sourced",
	"drafted",
	"applied",
	"hr_screening",
	"technical_interview",
	"offer",
	"rejected",
	"withdrawn",
	"ghosted",
] as const;
export type Status = (typeof STATUSES)[number];

export const EVENT_KINDS = [
	"screening",
	"interview",
	"offer",
	"rejected",
	"withdrawn",
	"ghosted",
	"follow_up",
] as const;
export type EventKind = (typeof EVENT_KINDS)[number];

/** Tone of a status mark: where it stands, not a colour per status. */
export type Tone = "quiet" | "waiting" | "active" | "won" | "lost";

export const STATUS_CONFIG: Record<Status, { label: string; tone: Tone }> = {
	sourced: { label: "Sourced", tone: "quiet" },
	drafted: { label: "To send", tone: "quiet" },
	applied: { label: "Applied", tone: "waiting" },
	hr_screening: { label: "Screening", tone: "active" },
	technical_interview: { label: "Interview", tone: "active" },
	offer: { label: "Offer", tone: "won" },
	rejected: { label: "Rejected", tone: "lost" },
	withdrawn: { label: "Withdrawn", tone: "lost" },
	ghosted: { label: "Ghosted", tone: "lost" },
};

export const EVENT_LABELS: Record<EventKind, string> = {
	screening: "Screening",
	interview: "Interview",
	offer: "Offer",
	rejected: "Rejected",
	withdrawn: "Withdrew",
	ghosted: "No answer, closed",
	follow_up: "Followed up",
};

/** Not sent yet: left out of every rate. */
export const PRE_APPLICATION: readonly Status[] = ["sourced", "drafted"];
export const IN_PROGRESS: readonly Status[] = ["hr_screening", "technical_interview", "offer"];
export const CLOSED: readonly Status[] = ["rejected", "withdrawn", "ghosted"];

/** Follow up on a sent application after this many days without an answer… */
export const FOLLOW_UP_DAYS = 7;
/** …and call it ghosted after this many. */
export const GHOST_DAYS = 14;

/** The status an event moves an application to, if any. */
export const STATUS_OF_EVENT: Partial<Record<EventKind, Status>> = {
	screening: "hr_screening",
	interview: "technical_interview",
	offer: "offer",
	rejected: "rejected",
	withdrawn: "withdrawn",
	ghosted: "ghosted",
};

/** The event a status change logs, if any. */
export const EVENT_OF_STATUS: Partial<Record<Status, EventKind>> = {
	hr_screening: "screening",
	technical_interview: "interview",
	offer: "offer",
	rejected: "rejected",
	withdrawn: "withdrawn",
	ghosted: "ghosted",
};

const RANK: Record<Status, number> = {
	sourced: 0,
	drafted: 1,
	applied: 2,
	hr_screening: 3,
	technical_interview: 4,
	offer: 5,
	rejected: 6,
	withdrawn: 6,
	ghosted: 6,
};

/**
 * The status after an event: an answer always lands; a screen or interview only moves an
 * application forward (booking a screen on one that's at interview leaves it there).
 */
export function statusAfterEvent(current: Status, kind: EventKind): Status {
	const next = STATUS_OF_EVENT[kind];
	if (!next) return current;
	if (CLOSED.includes(next)) return next;
	return RANK[next] > RANK[current] || CLOSED.includes(current) ? next : current;
}

/** Statuses from before v2 still in the enum until it's narrowed; read as their v2 meaning. */
export function toStatus(value: string): Status {
	if (value === "under_review") return "applied";
	if (value === "video_interview") return "hr_screening";
	return (STATUSES as readonly string[]).includes(value) ? (value as Status) : "applied";
}

// ── Days ──

const DAY = 86_400_000;

/** Whole days from one YYYY-MM-DD to another (calendar days, no time zone involved). */
export function daysBetween(from: string, to: string): number {
	return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY);
}

export function addDays(date: string, n: number): string {
	return new Date(Date.parse(`${date}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);
}

/** Answers: anything from the company's side, a rejection included. */
export const ANSWER_KINDS: readonly EventKind[] = ["screening", "interview", "offer", "rejected"];

export interface WaitingInput {
	status: Status;
	dateApplied: string;
	/** Latest follow-up, if any. */
	followedUpOn: string | null;
	/** Whether the company has answered in any way. */
	answered: boolean;
}

export type Waiting = {
	/** Days since it was sent. */
	days: number;
	/** What's due: a nudge, or closing it as ghosted. */
	due: "follow_up" | "ghost" | null;
};

/**
 * For a sent application with no answer: how long it's been, and what's due. Else null.
 * The clock runs from the last touch: a follow-up gives it another GHOST_DAYS.
 */
export function waiting(app: WaitingInput, today: string): Waiting | null {
	if (app.status !== "applied" || app.answered) return null;
	const days = Math.max(0, daysBetween(app.dateApplied, today));
	const followedUp = app.followedUpOn != null && app.followedUpOn >= app.dateApplied;
	const quiet = followedUp ? Math.max(0, daysBetween(app.followedUpOn as string, today)) : days;
	if (quiet >= GHOST_DAYS) return { days, due: "ghost" };
	if (!followedUp && quiet >= FOLLOW_UP_DAYS) return { days, due: "follow_up" };
	return { days, due: null };
}
