"use server";

// The connected Google account, from Settings and the calendar: show or hide its calendars,
// sync now, disconnect; change or delete an event in one of its calendars (online only).

import { and, db, eq, googleAccounts, googleCalendars, googleEvents } from "@seikatsu/db";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { calendarApi, revoke, tokenFor } from "@/features/calendar/google/api";
import { renewChannels, stopChannels } from "@/features/calendar/google/channels";
import { fromGoogle } from "@/features/calendar/google/map";
import { syncGoogle } from "@/features/calendar/google/sync";
import { revalidateShell } from "@/lib/revalidate";
import { unseal } from "@/lib/seal";
import { requireWorkspace } from "@/lib/session";
import { getUserTimeZone } from "@/lib/timezone";

type Result = { error: string } | { success: true };

async function accountOf(workspaceId: string) {
	const [account] = await db
		.select()
		.from(googleAccounts)
		.where(eq(googleAccounts.workspaceId, workspaceId));
	return account ?? null;
}

function refresh() {
	revalidatePath("/settings/calendar");
	revalidatePath("/");
}

/** Reads Google now (and notes the zone the user is in). */
export async function syncNow(): Promise<Result> {
	const ws = await requireWorkspace();
	const account = await accountOf(ws.id);
	if (!account) return { error: "No Google account connected" };
	await db
		.update(googleAccounts)
		.set({ timeZone: await getUserTimeZone() })
		.where(eq(googleAccounts.workspaceId, ws.id));
	await syncGoogle(ws.id);
	const latest = await accountOf(ws.id);
	refresh();
	return latest?.lastError ? { error: latest.lastError } : { success: true };
}

const shownSchema = z.object({ id: z.uuid(), shown: z.boolean() });

export async function setCalendarShown(input: z.input<typeof shownSchema>): Promise<Result> {
	const ws = await requireWorkspace();
	const parsed = shownSchema.safeParse(input);
	if (!parsed.success) return { error: "Calendar not found" };
	const updated = await db
		.update(googleCalendars)
		.set({ shown: parsed.data.shown })
		.where(
			and(
				eq(googleCalendars.id, parsed.data.id),
				eq(googleCalendars.workspaceId, ws.id),
				eq(googleCalendars.own, false),
			),
		)
		.returning({ id: googleCalendars.id });
	if (updated.length === 0) return { error: "Calendar not found" };
	if (!parsed.data.shown)
		await db.delete(googleEvents).where(eq(googleEvents.calendarId, parsed.data.id));
	after(async () => {
		await syncGoogle(ws.id);
		await renewChannels(ws.id).catch(() => undefined);
	});
	refresh();
	return { success: true };
}

/** Lets the account go: Google's grant revoked, everything kept from it deleted. The
 * "seikatsu" calendar stays in Google with what's in it. */
export async function disconnectGoogle(): Promise<Result> {
	const ws = await requireWorkspace();
	const account = await accountOf(ws.id);
	if (!account) return { success: true };
	try {
		await stopChannels(ws.id, await tokenFor(account));
	} catch {
		// The grant may be gone already.
	}
	await revoke(unseal(account.refreshToken));
	await db.delete(googleAccounts).where(eq(googleAccounts.workspaceId, ws.id));
	refresh();
	revalidateShell();
	return { success: true };
}

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const googleEventSchema = z.object({
	calendarId: z.uuid(),
	googleId: z.string().min(1).max(1024),
	title: z.string().trim().min(1, "Name the event").max(500),
	date: day,
	endDate: day.nullable(),
	startTime: time.nullable(),
	endTime: time.nullable(),
	note: z.string().max(8000).nullable(),
});

async function writableCalendar(workspaceId: string, id: string) {
	const [c] = await db
		.select()
		.from(googleCalendars)
		.where(and(eq(googleCalendars.id, id), eq(googleCalendars.workspaceId, workspaceId)));
	return c?.writable ? c : null;
}

const hourAfter = (t: string) => {
	const [h, m] = t.split(":").map(Number);
	const end = Math.min(23 * 60 + 59, h * 60 + m + 60);
	return `${String(Math.floor(end / 60)).padStart(2, "0")}:${String(end % 60).padStart(2, "0")}`;
};
const nextDay = (d: string) => {
	const x = new Date(`${d}T00:00:00Z`);
	x.setUTCDate(x.getUTCDate() + 1);
	return x.toISOString().slice(0, 10);
};

/** Changes an event in one of the user's Google calendars (a repeating one: that day only). */
export async function saveGoogleEvent(input: z.input<typeof googleEventSchema>): Promise<Result> {
	const ws = await requireWorkspace();
	const parsed = googleEventSchema.safeParse(input);
	if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Can't save that" };
	const e = parsed.data;
	const [calendar, account] = await Promise.all([
		writableCalendar(ws.id, e.calendarId),
		accountOf(ws.id),
	]);
	if (!calendar || !account) return { error: "That calendar can't be changed from here" };
	const last = e.endDate && e.endDate > e.date ? e.endDate : e.date;
	const tz = account.timeZone;
	try {
		const api = calendarApi(await tokenFor(account));
		const written = await api.patch(calendar.googleId, e.googleId, {
			summary: e.title,
			description: e.note ?? "",
			start: e.startTime
				? { dateTime: `${e.date}T${e.startTime}:00`, timeZone: tz }
				: { date: e.date },
			end: e.startTime
				? {
						dateTime: `${last}T${e.endTime && e.endTime > e.startTime ? e.endTime : hourAfter(e.startTime)}:00`,
						timeZone: tz,
					}
				: { date: nextDay(last) },
		});
		const row = fromGoogle(written, tz);
		if (row)
			await db
				.update(googleEvents)
				.set(row)
				.where(
					and(eq(googleEvents.calendarId, calendar.id), eq(googleEvents.googleId, e.googleId)),
				);
	} catch (err) {
		return { error: err instanceof Error ? err.message : "Google didn't take the change" };
	}
	revalidateShell();
	return { success: true };
}

const deleteSchema = z.object({ calendarId: z.uuid(), googleId: z.string().min(1).max(1024) });

export async function deleteGoogleEvent(input: z.input<typeof deleteSchema>): Promise<Result> {
	const ws = await requireWorkspace();
	const parsed = deleteSchema.safeParse(input);
	if (!parsed.success) return { error: "Event not found" };
	const [calendar, account] = await Promise.all([
		writableCalendar(ws.id, parsed.data.calendarId),
		accountOf(ws.id),
	]);
	if (!calendar || !account) return { error: "That calendar can't be changed from here" };
	try {
		const api = calendarApi(await tokenFor(account));
		await api.remove(calendar.googleId, parsed.data.googleId);
	} catch (err) {
		return { error: err instanceof Error ? err.message : "Google didn't delete it" };
	}
	await db
		.delete(googleEvents)
		.where(
			and(
				eq(googleEvents.calendarId, calendar.id),
				eq(googleEvents.googleId, parsed.data.googleId),
			),
		);
	revalidateShell();
	return { success: true };
}
