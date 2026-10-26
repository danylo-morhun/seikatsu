// Reads mail the Gmail script posts and turns answers into events. Not a "use server" module:
// the API route resolves the workspace from its key; the review actions own their checks.

import { createHash } from "node:crypto";
import {
	and,
	db,
	desc,
	eq,
	gte,
	inArray,
	isNull,
	kyuuApplications,
	kyuuEvents,
	kyuuMail,
	kyuuMailKeys,
	ne,
} from "@seikatsu/db";
import { askGemini } from "../lib/gemini";
import {
	type MailCandidate,
	type MailMessage,
	fromHiringPlatform,
	gmailLink,
	mailCandidates,
} from "../lib/mail-match";
import {
	type MailKind,
	readVerdict,
	stateOf,
	verdictPrompt,
	verdictSchema,
} from "../lib/mail-verdict";
import { type Status, addDays, daysBetween, statusAfterEvent, toStatus } from "../lib/stages";

/** Gemini calls per sync: the free tier allows a few a minute. The rest wait for the next run. */
const MAX_READS = 10;
/** A platform's mail that names no company is checked against this many of the latest. */
const PLATFORM_CANDIDATES = 60;
/** Applications older than this aren't waiting for mail any more. */
const LOOKBACK_DAYS = 180;

export function hashMailKey(key: string): string {
	return createHash("sha256").update(key).digest("hex");
}

/** The workspace a sync key belongs to, and when it last synced. */
export async function workspaceOfMailKey(key: string) {
	const [row] = await db
		.select({ workspaceId: kyuuMailKeys.workspaceId, lastSyncAt: kyuuMailKeys.lastSyncAt })
		.from(kyuuMailKeys)
		.where(eq(kyuuMailKeys.keyHash, hashMailKey(key)))
		.limit(1);
	return row ?? null;
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export interface Answer {
	applicationId: string;
	kind: MailKind;
	date: string;
	time: string | null;
	note: string | null;
}

/**
 * Logs an answer on its application and moves the status with it, unless the timeline already
 * has it: a rejection or offer at all, a screen or interview on the same day or in the week
 * before (the thread that booked it, still going). Null when it was already there.
 */
export async function logAnswer(
	tx: Tx,
	answer: Answer,
): Promise<{ eventId: string; previousStatus: Status } | null> {
	const [app] = await tx
		.select({ status: kyuuApplications.status })
		.from(kyuuApplications)
		.where(eq(kyuuApplications.id, answer.applicationId))
		.limit(1);
	if (!app) return null;
	const same = await tx
		.select({ date: kyuuEvents.date })
		.from(kyuuEvents)
		.where(
			and(eq(kyuuEvents.applicationId, answer.applicationId), eq(kyuuEvents.kind, answer.kind)),
		);
	const already = same.some(
		(e) =>
			answer.kind === "rejected" ||
			answer.kind === "offer" ||
			e.date == null ||
			Math.abs(daysBetween(e.date, answer.date)) <= 7,
	);
	if (already) return null;

	const previousStatus = toStatus(app.status);
	const [event] = await tx
		.insert(kyuuEvents)
		.values({
			applicationId: answer.applicationId,
			kind: answer.kind,
			date: answer.date,
			time: answer.time,
			note: answer.note,
		})
		.returning({ id: kyuuEvents.id });
	await tx
		.update(kyuuApplications)
		.set({ status: statusAfterEvent(previousStatus, answer.kind), updatedAt: new Date() })
		.where(eq(kyuuApplications.id, answer.applicationId));
	return { eventId: event.id, previousStatus };
}

/** The note an event from mail carries. */
export function mailNote(summary: string | null): string {
	return summary ? `${summary} · from mail` : "From mail";
}

export interface SyncResult {
	received: number;
	read: number;
	applied: number;
	review: number;
	/** Left for the next run: over this run's Gemini budget, or Gemini failed. */
	deferred: number;
}

/** Reads what's new among `messages` for the workspace. */
export async function syncMail(
	workspaceId: string,
	messages: MailMessage[],
	account: string | null,
): Promise<SyncResult> {
	const result: SyncResult = {
		received: messages.length,
		read: 0,
		applied: 0,
		review: 0,
		deferred: 0,
	};
	if (messages.length === 0) return result;

	const seen = new Set(
		(
			await db
				.select({ messageId: kyuuMail.messageId })
				.from(kyuuMail)
				.where(
					and(
						eq(kyuuMail.workspaceId, workspaceId),
						inArray(
							kyuuMail.messageId,
							messages.map((m) => m.id),
						),
					),
				)
		).map((r) => r.messageId),
	);
	const fresh = messages.filter((m) => !seen.has(m.id)).sort((a, b) => (a.date < b.date ? -1 : 1));
	if (fresh.length === 0) return result;

	const latestDay = fresh.reduce((d, m) => (m.day > d ? m.day : d), fresh[0].day);
	const apps: (MailCandidate & { dateApplied: string })[] = await db
		.select({
			id: kyuuApplications.id,
			company: kyuuApplications.company,
			role: kyuuApplications.role,
			jobUrl: kyuuApplications.jobUrl,
			dateApplied: kyuuApplications.dateApplied,
		})
		.from(kyuuApplications)
		.where(
			and(
				eq(kyuuApplications.workspaceId, workspaceId),
				isNull(kyuuApplications.archivedAt),
				ne(kyuuApplications.status, "sourced"),
				gte(kyuuApplications.dateApplied, addDays(latestDay, -LOOKBACK_DAYS)),
			),
		)
		.orderBy(desc(kyuuApplications.dateApplied));

	const skip = (m: MailMessage) =>
		db
			.insert(kyuuMail)
			.values({ workspaceId, messageId: m.id, state: "skipped" })
			.onConflictDoNothing();

	for (const [i, mail] of fresh.entries()) {
		const named = mailCandidates(mail, apps);
		if (named.length === 0 && !fromHiringPlatform(mail.from)) {
			await skip(mail);
			continue;
		}
		if (result.read >= MAX_READS) {
			result.deferred = fresh.length - i;
			break;
		}

		const candidates = named.length > 0 ? named : apps.slice(0, PLATFORM_CANDIDATES);
		let raw: unknown;
		try {
			raw = await askGemini(verdictPrompt(mail, candidates), verdictSchema(candidates.length));
		} catch {
			// Out of quota or down: everything left is read on the next run.
			result.deferred = fresh.length - i;
			break;
		}
		result.read++;

		const verdict = readVerdict(raw, candidates);
		const state = stateOf(verdict);
		if (state === "skipped" || !verdict.kind) {
			await skip(mail);
			continue;
		}
		const kept = {
			workspaceId,
			messageId: mail.id,
			sender: mail.from.slice(0, 300),
			subject: mail.subject.slice(0, 500),
			link: gmailLink(mail.threadId, account),
			receivedAt: new Date(mail.date),
			applicationId: verdict.applicationId,
			kind: verdict.kind,
			eventDate: verdict.date,
			eventTime: verdict.time,
			summary: verdict.summary,
		};

		if (state === "review" || !verdict.applicationId) {
			await db
				.insert(kyuuMail)
				.values({ ...kept, state: "review" })
				.onConflictDoNothing();
			result.review++;
			continue;
		}

		const applicationId = verdict.applicationId;
		const kind = verdict.kind;
		await db.transaction(async (tx) => {
			const [row] = await tx
				.insert(kyuuMail)
				.values({ ...kept, state: "skipped" })
				.onConflictDoNothing()
				.returning({ id: kyuuMail.id });
			// Another run got to it first.
			if (!row) return;
			const logged = await logAnswer(tx, {
				applicationId,
				kind,
				date: verdict.date ?? mail.day,
				time: verdict.date ? verdict.time : null,
				note: mailNote(verdict.summary),
			});
			if (!logged) return;
			await tx
				.update(kyuuMail)
				.set({ state: "applied", ...logged })
				.where(eq(kyuuMail.id, row.id));
			result.applied++;
		});
	}

	return result;
}
