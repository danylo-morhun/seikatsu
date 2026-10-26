"use server";

import { randomBytes } from "node:crypto";
import { getCurrentWorkspace, isUuid, requireWorkspace } from "@/lib/session";
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
	or,
} from "@seikatsu/db";
import { type MailKind, isMailKind } from "../lib/mail-verdict";
import { type Result, getOwnedApplication, revalidateKyuu } from "./guard";
import { hashMailKey, logAnswer, mailNote } from "./mail-sync";

/** Applied answers stay on the table's mail bar this long (or until seen), to be undone. */
const RECENT_DAYS = 7;

export interface MailItem {
	id: string;
	state: "applied" | "review";
	sender: string | null;
	subject: string | null;
	link: string | null;
	receivedAt: string | null;
	kind: MailKind;
	eventDate: string | null;
	eventTime: string | null;
	summary: string | null;
	application: { id: string; company: string; role: string } | null;
}

export interface MailChoice {
	id: string;
	company: string;
	role: string;
}

/**
 * Mail to look at: answers waiting for review, and the ones applied lately. `choices` are the
 * applications to pick from when Gemini couldn't tell which one a mail is about.
 */
export async function getMailInbox(): Promise<{ items: MailItem[]; choices: MailChoice[] }> {
	const ws = await getCurrentWorkspace();
	if (!ws) return { items: [], choices: [] };
	const rows = await db
		.select({
			id: kyuuMail.id,
			state: kyuuMail.state,
			sender: kyuuMail.sender,
			subject: kyuuMail.subject,
			link: kyuuMail.link,
			receivedAt: kyuuMail.receivedAt,
			kind: kyuuMail.kind,
			eventDate: kyuuMail.eventDate,
			eventTime: kyuuMail.eventTime,
			summary: kyuuMail.summary,
			appId: kyuuApplications.id,
			company: kyuuApplications.company,
			role: kyuuApplications.role,
		})
		.from(kyuuMail)
		.leftJoin(kyuuApplications, eq(kyuuApplications.id, kyuuMail.applicationId))
		.where(
			and(
				eq(kyuuMail.workspaceId, ws.id),
				or(
					eq(kyuuMail.state, "review"),
					and(
						eq(kyuuMail.state, "applied"),
						isNull(kyuuMail.seenAt),
						gte(kyuuMail.createdAt, new Date(Date.now() - RECENT_DAYS * 86_400_000)),
					),
				),
			),
		)
		.orderBy(desc(kyuuMail.receivedAt))
		.limit(50);
	const items: MailItem[] = rows.flatMap((r) =>
		(r.state === "applied" || r.state === "review") && isMailKind(r.kind)
			? [
					{
						id: r.id,
						state: r.state,
						sender: r.sender,
						subject: r.subject,
						link: r.link,
						receivedAt: r.receivedAt?.toISOString() ?? null,
						kind: r.kind,
						eventDate: r.eventDate,
						eventTime: r.eventTime?.slice(0, 5) ?? null,
						summary: r.summary,
						application: r.appId
							? { id: r.appId, company: r.company ?? "", role: r.role ?? "" }
							: null,
					},
				]
			: [],
	);
	const choices = items.some((i) => i.state === "review")
		? await db
				.select({
					id: kyuuApplications.id,
					company: kyuuApplications.company,
					role: kyuuApplications.role,
				})
				.from(kyuuApplications)
				.where(
					and(
						eq(kyuuApplications.workspaceId, ws.id),
						isNull(kyuuApplications.archivedAt),
						ne(kyuuApplications.status, "sourced"),
					),
				)
				.orderBy(desc(kyuuApplications.dateApplied))
				.limit(150)
		: [];
	return { items, choices };
}

async function getOwnedMail(mailId: string) {
	if (!isUuid(mailId)) return null;
	const ws = await getCurrentWorkspace();
	if (!ws) return null;
	const [row] = await db
		.select()
		.from(kyuuMail)
		.where(and(eq(kyuuMail.id, mailId), eq(kyuuMail.workspaceId, ws.id)))
		.limit(1);
	return row ?? null;
}

/** Review: logs the answer on the application picked (Gemini's guess, or another). */
export async function confirmMail(
	mailId: string,
	applicationId: string,
): Promise<Result<{ logged: boolean }>> {
	const mail = await getOwnedMail(mailId);
	if (!mail || mail.state !== "review" || !isMailKind(mail.kind))
		return { error: "Nothing to confirm" };
	const app = await getOwnedApplication(applicationId);
	if (!app) return { error: "Application not found" };
	const kind: MailKind = mail.kind;
	const day = (mail.receivedAt ?? mail.createdAt).toISOString().slice(0, 10);

	const logged = await db.transaction(async (tx) => {
		const done = await logAnswer(tx, {
			applicationId: app.id,
			kind,
			date: mail.eventDate ?? day,
			time: mail.eventDate ? (mail.eventTime?.slice(0, 5) ?? null) : null,
			note: mailNote(mail.summary),
		});
		await tx
			.update(kyuuMail)
			.set(
				done
					? { state: "applied", applicationId: app.id, ...done }
					: { state: "dismissed", applicationId: app.id },
			)
			.where(eq(kyuuMail.id, mail.id));
		return !!done;
	});
	revalidateKyuu();
	return { success: true, data: { logged } };
}

/** Review: not an answer after all. */
export async function dismissMail(mailId: string): Promise<Result> {
	const mail = await getOwnedMail(mailId);
	if (!mail || mail.state !== "review") return { error: "Nothing to dismiss" };
	await db.update(kyuuMail).set({ state: "dismissed" }).where(eq(kyuuMail.id, mail.id));
	revalidateKyuu();
	return { success: true };
}

/** Takes back an answer applied from mail: its event goes, the status returns. */
export async function undoMail(mailId: string): Promise<Result> {
	const mail = await getOwnedMail(mailId);
	if (!mail || mail.state !== "applied") return { error: "Nothing to undo" };
	await db.transaction(async (tx) => {
		if (mail.eventId) await tx.delete(kyuuEvents).where(eq(kyuuEvents.id, mail.eventId));
		if (mail.applicationId && mail.previousStatus)
			await tx
				.update(kyuuApplications)
				.set({ status: mail.previousStatus, updatedAt: new Date() })
				.where(eq(kyuuApplications.id, mail.applicationId));
		await tx
			.update(kyuuMail)
			.set({ state: "dismissed", eventId: null })
			.where(eq(kyuuMail.id, mail.id));
	});
	revalidateKyuu();
	return { success: true };
}

/** Clears applied ones off the bar: looked at, they stay as they are. */
export async function markMailSeen(ids: string[]): Promise<Result> {
	const ws = await requireWorkspace();
	const valid = ids.filter(isUuid).slice(0, 100);
	if (valid.length === 0) return { success: true };
	await db
		.update(kyuuMail)
		.set({ seenAt: new Date() })
		.where(
			and(
				eq(kyuuMail.workspaceId, ws.id),
				eq(kyuuMail.state, "applied"),
				inArray(kyuuMail.id, valid),
			),
		);
	revalidateKyuu();
	return { success: true };
}

// ── The sync key ──

export interface MailKeyStatus {
	createdAt: string;
	lastSyncAt: string | null;
}

export async function getMailKeyStatus(): Promise<MailKeyStatus | null> {
	const ws = await getCurrentWorkspace();
	if (!ws) return null;
	const [row] = await db
		.select({ createdAt: kyuuMailKeys.createdAt, lastSyncAt: kyuuMailKeys.lastSyncAt })
		.from(kyuuMailKeys)
		.where(eq(kyuuMailKeys.workspaceId, ws.id))
		.limit(1);
	return row
		? { createdAt: row.createdAt.toISOString(), lastSyncAt: row.lastSyncAt?.toISOString() ?? null }
		: null;
}

/** A new key for the Gmail script; the old one stops working. Shown once, stored hashed. */
export async function createMailKey(): Promise<Result<{ key: string }>> {
	const ws = await requireWorkspace();
	const key = `kyuu_${randomBytes(32).toString("base64url")}`;
	await db
		.insert(kyuuMailKeys)
		.values({ workspaceId: ws.id, keyHash: hashMailKey(key) })
		.onConflictDoUpdate({
			target: kyuuMailKeys.workspaceId,
			set: { keyHash: hashMailKey(key), createdAt: new Date(), lastSyncAt: null },
		});
	revalidateKyuu();
	return { success: true, data: { key } };
}

export async function deleteMailKey(): Promise<Result> {
	const ws = await requireWorkspace();
	await db.delete(kyuuMailKeys).where(eq(kyuuMailKeys.workspaceId, ws.id));
	revalidateKyuu();
	return { success: true };
}
