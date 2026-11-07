// What the job search waits on today, read without a session (Today, Week and the morning
// push share it): applications to send, calls booked, quiet ones to close
// as ghosted, and mail Gemini wasn't sure about. Same rules as the table (lib/stages).

import {
	and,
	count,
	db,
	eq,
	inArray,
	isNull,
	kyuuApplications,
	kyuuEvents,
	kyuuMail,
} from "@seikatsu/db";
import { ANSWER_KINDS, addDays, toStatus, waiting } from "@/features/kyuu/lib/stages";

export type JobRef = { id: string; company: string };
export type JobCall = JobRef & {
	kind: "screening" | "interview";
	date: string;
	time: string | null;
};

export type JobsAgenda = {
	/** Sourced or drafted, waiting to be sent by hand. */
	toSend: number;
	/** Screenings and interviews today and tomorrow, soonest first. */
	calls: JobCall[];
	/** Quiet long enough to close as ghosted. */
	ghostIds: string[];
	/** Answers from mail that wait for a look. */
	mailReview: number;
};

export async function readJobsAgenda(workspaceId: string, today: string): Promise<JobsAgenda> {
	const tomorrow = addDays(today, 1);
	const [apps, [mail]] = await Promise.all([
		db
			.select({
				id: kyuuApplications.id,
				company: kyuuApplications.company,
				status: kyuuApplications.status,
				dateApplied: kyuuApplications.dateApplied,
			})
			.from(kyuuApplications)
			.where(
				and(eq(kyuuApplications.workspaceId, workspaceId), isNull(kyuuApplications.archivedAt)),
			),
		db
			.select({ n: count() })
			.from(kyuuMail)
			.where(and(eq(kyuuMail.workspaceId, workspaceId), eq(kyuuMail.state, "review"))),
	]);
	const agenda: JobsAgenda = {
		toSend: 0,
		calls: [],
		ghostIds: [],
		mailReview: mail?.n ?? 0,
	};
	if (apps.length === 0) return agenda;

	const events = await db
		.select({
			applicationId: kyuuEvents.applicationId,
			kind: kyuuEvents.kind,
			date: kyuuEvents.date,
			time: kyuuEvents.time,
		})
		.from(kyuuEvents)
		.where(
			inArray(
				kyuuEvents.applicationId,
				apps.map((a) => a.id),
			),
		);

	for (const app of apps) {
		if (app.status === "sourced" || app.status === "drafted") agenda.toSend++;
		const own = events.filter((e) => e.applicationId === app.id);
		for (const e of own)
			if (
				(e.kind === "screening" || e.kind === "interview") &&
				(e.date === today || e.date === tomorrow)
			)
				agenda.calls.push({
					id: app.id,
					company: app.company,
					kind: e.kind,
					date: e.date,
					time: e.time?.slice(0, 5) ?? null,
				});
		const followedUpOn =
			own
				.filter((e) => e.kind === "follow_up" && e.date)
				.map((e) => e.date as string)
				.sort()
				.at(-1) ?? null;
		const due = waiting(
			{
				status: toStatus(app.status),
				dateApplied: app.dateApplied,
				followedUpOn,
				answered: own.some((e) => ANSWER_KINDS.includes(e.kind)),
			},
			today,
		)?.due;
		if (due === "ghost") agenda.ghostIds.push(app.id);
	}
	agenda.calls.sort(
		(a, b) => a.date.localeCompare(b.date) || (a.time ?? "").localeCompare(b.time ?? ""),
	);
	return agenda;
}
