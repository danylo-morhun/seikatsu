"use server";

import { requireWorkspace } from "@/lib/session";
import { getUserToday } from "@/lib/timezone";
import { and, db, eq, inArray, isNull, kyuuApplications, kyuuEvents } from "@seikatsu/db";
import { z } from "zod";
import {
	EVENT_KINDS,
	EVENT_OF_STATUS,
	STATUSES,
	type Status,
	statusAfterEvent,
} from "../lib/stages";
import { type Result, getOwnedApplication, getOwnedEvent, isDay, revalidateKyuu } from "./guard";

const statusSchema = z.enum(STATUSES);

const eventSchema = z.object({
	/** Made on the device, so a replayed (offline) log lands once. */
	id: z.string().uuid().optional(),
	kind: z.enum(EVENT_KINDS),
	date: z.string().refine(isDay, "Pick a date").nullable(),
	time: z
		.string()
		.regex(/^\d{2}:\d{2}$/, "Time as HH:MM")
		.nullable(),
	note: z.string().trim().max(2000).nullable(),
});
export type EventInput = z.infer<typeof eventSchema>;

/**
 * Moves an application to a status. Reaching a stage or an answer logs it as an event dated
 * today (editable on the timeline); sending a drafted one dates it today.
 */
export async function setStatus(
	applicationId: string,
	status: Status,
): Promise<Result<{ status: Status }>> {
	const parsed = statusSchema.safeParse(status);
	if (!parsed.success) return { error: "Unknown status" };
	const app = await getOwnedApplication(applicationId);
	if (!app) return { error: "Application not found" };
	if (app.status === parsed.data) return { success: true, data: { status: app.status } };

	const today = await getUserToday();
	const kind = EVENT_OF_STATUS[parsed.data];
	const sending =
		parsed.data === "applied" && (app.status === "drafted" || app.status === "sourced");
	await db.transaction(async (tx) => {
		await tx
			.update(kyuuApplications)
			.set({
				status: parsed.data,
				...(sending ? { dateApplied: today } : {}),
				updatedAt: new Date(),
			})
			.where(eq(kyuuApplications.id, app.id));
		if (kind) await tx.insert(kyuuEvents).values({ applicationId: app.id, kind, date: today });
	});
	revalidateKyuu();
	return { success: true, data: { status: parsed.data } };
}

/** Logs what happened or what's booked; a stage or an answer moves the status with it. */
export async function logEvent(
	applicationId: string,
	input: EventInput,
): Promise<Result<{ status: Status }>> {
	const parsed = eventSchema.safeParse(input);
	if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid event" };
	const app = await getOwnedApplication(applicationId);
	if (!app) return { error: "Application not found" };

	if (parsed.data.id && (await getOwnedEvent(parsed.data.id))) {
		// Sent again (offline replay, lost response): the first one stands.
		return { success: true, data: { status: app.status } };
	}
	const status = statusAfterEvent(app.status, parsed.data.kind);
	await db.transaction(async (tx) => {
		await tx.insert(kyuuEvents).values({ applicationId: app.id, ...parsed.data });
		await tx
			.update(kyuuApplications)
			.set({ status, updatedAt: new Date() })
			.where(eq(kyuuApplications.id, app.id));
	});
	revalidateKyuu();
	return { success: true, data: { status } };
}

/** Moves an event's day, time or note. Its kind stays; delete and log another to change it. */
export async function updateEvent(
	eventId: string,
	input: Omit<EventInput, "kind">,
): Promise<Result> {
	const parsed = eventSchema.omit({ kind: true }).safeParse(input);
	if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid event" };
	const event = await getOwnedEvent(eventId);
	if (!event) return { error: "Event not found" };
	await db.update(kyuuEvents).set(parsed.data).where(eq(kyuuEvents.id, event.id));
	revalidateKyuu();
	return { success: true };
}

/** Removes an event from the timeline. The status stays where it is. */
export async function deleteEvent(eventId: string): Promise<Result> {
	const event = await getOwnedEvent(eventId);
	if (!event) return { error: "Event not found" };
	await db.delete(kyuuEvents).where(eq(kyuuEvents.id, event.id));
	revalidateKyuu();
	return { success: true };
}

const followUpSchema = z.object({
	/** Made on the device, so a replayed (offline) follow-up lands once. */
	id: z.string().uuid().optional(),
	/** The day it was sent, when it arrives later (made offline). Never after today. */
	date: z.string().refine(isDay).optional(),
});

/** "Followed up" today (or on the offline day it was sent): restarts the waiting clock. */
export async function followUp(
	applicationId: string,
	options: z.input<typeof followUpSchema> = {},
): Promise<Result> {
	const parsed = followUpSchema.safeParse(options);
	if (!parsed.success) return { error: "Invalid follow-up" };
	const app = await getOwnedApplication(applicationId);
	if (!app) return { error: "Application not found" };
	const { id, date } = parsed.data;
	if (id && (await getOwnedEvent(id))) return { success: true };
	const today = await getUserToday();
	await db.insert(kyuuEvents).values({
		id,
		applicationId: app.id,
		kind: "follow_up",
		date: date && date < today ? date : today,
	});
	revalidateKyuu();
	return { success: true };
}

/** Closes sent applications nobody answered as ghosted, logged today. Others are skipped. */
export async function ghostApplications(ids: string[]): Promise<Result<{ count: number }>> {
	const parsed = z.array(z.string().uuid()).max(1000).safeParse(ids);
	if (!parsed.success) return { error: "Invalid selection" };
	if (parsed.data.length === 0) return { success: true, data: { count: 0 } };
	const ws = await requireWorkspace();
	const today = await getUserToday();

	const count = await db.transaction(async (tx) => {
		const closed = await tx
			.update(kyuuApplications)
			.set({ status: "ghosted", updatedAt: new Date() })
			.where(
				and(
					inArray(kyuuApplications.id, parsed.data),
					eq(kyuuApplications.workspaceId, ws.id),
					eq(kyuuApplications.status, "applied"),
					isNull(kyuuApplications.archivedAt),
				),
			)
			.returning({ id: kyuuApplications.id });
		if (closed.length > 0)
			await tx
				.insert(kyuuEvents)
				.values(
					closed.map(({ id }) => ({ applicationId: id, kind: "ghosted" as const, date: today })),
				);
		return closed.length;
	});
	revalidateKyuu();
	return { success: true, data: { count } };
}

/** Puts an application away (or back): archived ones leave Now, All and Stats. */
export async function setArchived(applicationId: string, archived: boolean): Promise<Result> {
	const app = await getOwnedApplication(applicationId);
	if (!app) return { error: "Application not found" };
	await db
		.update(kyuuApplications)
		.set({ archivedAt: archived ? new Date() : null })
		.where(eq(kyuuApplications.id, app.id));
	revalidateKyuu();
	return { success: true };
}
