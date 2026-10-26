import type { KyuuApplyMethod } from "./kyuu-schemas";
import type { EventKind, Status, Waiting } from "./stages";

export interface KyuuEvent {
	id: string;
	kind: EventKind;
	/** Null when the day isn't known. */
	date: string | null;
	/** HH:MM, for a booked screen or interview. */
	time: string | null;
	note: string | null;
}

/** One application as lists show it. */
export interface ApplicationRow {
	id: string;
	company: string;
	role: string;
	jobUrl: string | null;
	source: string | null;
	/** ISO 3166-1 alpha-2, or null when unknown. */
	country: string | null;
	status: Status;
	applyMethod: KyuuApplyMethod;
	dateApplied: string;
	notes: string | null;
	archived: boolean;
	/** The next booked screen or interview, today or later. */
	next: Pick<KyuuEvent, "kind" | "date" | "time"> | null;
	/** Sent, no answer yet: how long, and what's due. */
	waiting: Waiting | null;
}

/** Everything the application's page shows: the row, the posting, the timeline. */
export interface ApplicationDetail extends ApplicationRow {
	contact: string | null;
	location: string | null;
	remote: boolean | null;
	salary: string | null;
	fitVerdict: string | null;
	stackTags: string[] | null;
	jobDescription: string | null;
	coverLetter: string | null;
	resumeFileUrl: string | null;
	resumeFileName: string | null;
	createdAt: string;
	/** Oldest first; unknown days by when they were logged. */
	events: KyuuEvent[];
}

export interface ResumeFile {
	fileUrl: string;
	fileName: string;
}
