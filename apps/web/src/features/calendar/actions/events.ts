"use server";

// The user's own events: save (create or edit, by the id made on the device) and delete. Both
// land the same state when run twice, so the offline outbox can replay them.

import { and, calendarEvents, db, eq, inArray } from "@seikatsu/db";
import {
	type CalendarEventInput,
	deleteEventSchema,
	type EventSetInput,
	eventSchema,
	eventSetSchema,
} from "@/features/calendar/lib/schemas";
import { revalidateShell } from "@/lib/revalidate";
import { requireWorkspace } from "@/lib/session";

type Result = { error: string } | { success: true };

export async function saveEvent(input: CalendarEventInput): Promise<Result> {
	const ws = await requireWorkspace();
	const parsed = eventSchema.safeParse(input);
	if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Can't save that event" };
	const { id, ...fields } = parsed.data;
	// An id is the device's own; one that names another workspace's event is refused.
	const [taken] = await db
		.select({ workspaceId: calendarEvents.workspaceId })
		.from(calendarEvents)
		.where(eq(calendarEvents.id, id));
	if (taken && taken.workspaceId !== ws.id) return { error: "Event not found" };
	const now = new Date();
	await db
		.insert(calendarEvents)
		.values({ id, workspaceId: ws.id, ...fields })
		.onConflictDoUpdate({ target: calendarEvents.id, set: { ...fields, updatedAt: now } });
	revalidateShell(ws.id);
	return { success: true };
}

export async function deleteEvent(input: { id: string }): Promise<Result> {
	const ws = await requireWorkspace();
	const parsed = deleteEventSchema.safeParse(input);
	if (!parsed.success) return { error: "Event not found" };
	await db
		.delete(calendarEvents)
		.where(and(eq(calendarEvents.id, parsed.data.id), eq(calendarEvents.workspaceId, ws.id)));
	revalidateShell(ws.id);
	return { success: true };
}

/**
 * A change to part of a repeating event (lib/events.ts `splitSeries`): the rows it saves and the
 * one it deletes, together or not at all. Saving by id, it lands the same when replayed.
 */
export async function saveEventSet(input: EventSetInput): Promise<Result> {
	const ws = await requireWorkspace();
	const parsed = eventSetSchema.safeParse(input);
	if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Can't save that event" };
	const { save, remove } = parsed.data;
	const ids = [...save.map((e) => e.id), ...remove];
	if (ids.length === 0) return { success: true };
	const taken = await db
		.select({ workspaceId: calendarEvents.workspaceId })
		.from(calendarEvents)
		.where(inArray(calendarEvents.id, ids));
	if (taken.some((t) => t.workspaceId !== ws.id)) return { error: "Event not found" };
	const now = new Date();
	await db.transaction(async (tx) => {
		for (const { id, ...fields } of save)
			await tx
				.insert(calendarEvents)
				.values({ id, workspaceId: ws.id, ...fields })
				.onConflictDoUpdate({ target: calendarEvents.id, set: { ...fields, updatedAt: now } });
		if (remove.length)
			await tx
				.delete(calendarEvents)
				.where(and(inArray(calendarEvents.id, remove), eq(calendarEvents.workspaceId, ws.id)));
	});
	revalidateShell(ws.id);
	return { success: true };
}
