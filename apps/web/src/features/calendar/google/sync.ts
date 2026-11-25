// Server-only: two-way sync with the user's Google Calendar.
//
// Pull: every shown calendar's events in a window around today land in google_events, on the
// user's clock. Mirror: seikatsu's own rows (events, cards due, booked calls, the car, bills)
// are written to a calendar of their own ("seikatsu") and remembered in google_mirror; an edit
// the user makes to one of them in Google (a later `updated` stamp) comes back through the
// app's own action — moving a card moves its due date — and a new event they add to that
// calendar becomes an event of their own here. Last edit wins.

import { AsyncLocalStorage } from "node:async_hooks";
import {
	and,
	db,
	eq,
	googleAccounts,
	googleCalendars,
	googleEvents,
	googleMirror,
	gte,
	inArray,
	lte,
	or,
	workspaces,
} from "@seikatsu/db";
import * as Sentry from "@sentry/nextjs";
import { deleteEvent, saveEvent } from "@/features/calendar/actions/events";
import { type CalendarApi, calendarApi, tokenFor } from "@/features/calendar/google/api";
import {
	type CachedEvent,
	editOf,
	fromGoogle,
	type GoogleEvent,
	hashOf,
	type MirrorItem,
	rruleOf,
	toGoogle,
} from "@/features/calendar/google/map";
import { readEvent, readEvents } from "@/features/calendar/lib/data";
import { addDays } from "@/features/calendar/lib/events";
import { updateCard } from "@/features/seiryu/actions/cards";
import { getWeekData } from "@/features/week/lib/data";
import { actAs } from "@/lib/actor";
import { modulesOn } from "@/lib/modules";
import { dayIn } from "@/lib/timezone";

/** The days kept from Google: a season back, a year ahead. */
const PULL_BACK = 92;
const PULL_AHEAD = 400;
/** seikatsu's rows written to Google: a week back, four months ahead. */
const PUSH_BACK = 7;
const PUSH_AHEAD = 120;
/** The calendar seikatsu writes to. */
export const OWN_CALENDAR = "seikatsu";

const origin = () =>
	(process.env.AUTH_URL ?? "https://seikatsu.danylomorhun.com").replace(/\/$/, "");

/** Set while a sync runs: the writes it makes don't ask for another sync. */
const syncing = new AsyncLocalStorage<true>();
export const inSync = () => syncing.getStore() === true;

/** One sync per workspace at a time; asked again while running, it runs once more after. */
const running = new Map<string, { again: boolean; pull: boolean; done: Promise<void> }>();

/**
 * Syncs a workspace with Google: `pull` reads Google's calendars too (the cron, the webhook,
 * "Sync now"); without, only seikatsu's own rows are sent (after a write here).
 */
export function syncGoogle(workspaceId: string, { pull = true }: { pull?: boolean } = {}) {
	const now = running.get(workspaceId);
	if (now) {
		now.again = true;
		now.pull ||= pull;
		return now.done;
	}
	const state = { again: true, pull, done: Promise.resolve() };
	state.done = (async () => {
		try {
			while (state.again) {
				state.again = false;
				const withPull = state.pull;
				state.pull = false;
				await syncing.run(true, () => syncOnce(workspaceId, withPull));
			}
		} finally {
			running.delete(workspaceId);
		}
	})();
	running.set(workspaceId, state);
	return state.done;
}

async function syncOnce(workspaceId: string, pull: boolean) {
	const [account] = await db
		.select()
		.from(googleAccounts)
		.where(eq(googleAccounts.workspaceId, workspaceId));
	if (!account) return;
	try {
		const api = calendarApi(await tokenFor(account));
		const ownId =
			pull || !account.ownCalendarId ? await syncCalendars(api, account) : account.ownCalendarId;
		if (pull) await pullShown(api, workspaceId, account.timeZone);
		await mirror(api, workspaceId, ownId, account.timeZone);
		await db
			.update(googleAccounts)
			.set({ ...(pull ? { lastSyncedAt: new Date() } : {}), lastError: null })
			.where(eq(googleAccounts.workspaceId, workspaceId));
	} catch (e) {
		Sentry.captureException(e, { tags: { sync: "google-calendar" } });
		await db
			.update(googleAccounts)
			.set({ lastError: e instanceof Error ? e.message.slice(0, 300) : "Sync failed" })
			.where(eq(googleAccounts.workspaceId, workspaceId));
	}
}

/** The account's calendars, kept in step; seikatsu's own made when it's missing. */
async function syncCalendars(
	api: CalendarApi,
	account: typeof googleAccounts.$inferSelect,
): Promise<string> {
	let list = await api.calendars();
	let ownId = account.ownCalendarId;
	if (!ownId || !list.some((c) => c.id === ownId)) {
		ownId = (await api.createCalendar(OWN_CALENDAR, account.timeZone)).id;
		await db
			.update(googleAccounts)
			.set({ ownCalendarId: ownId })
			.where(eq(googleAccounts.workspaceId, account.workspaceId));
		// A new calendar: what was written to the old one is gone with it.
		await db.delete(googleMirror).where(eq(googleMirror.workspaceId, account.workspaceId));
		list = await api.calendars();
	}
	for (const c of list) {
		const own = c.id === ownId;
		await db
			.insert(googleCalendars)
			.values({
				workspaceId: account.workspaceId,
				googleId: c.id,
				name: own ? OWN_CALENDAR : (c.summaryOverride ?? c.summary),
				color: c.backgroundColor ?? null,
				writable: c.accessRole === "owner" || c.accessRole === "writer",
				own,
				// Calendars hidden in Google start hidden here too.
				shown: !own && !c.hidden,
			})
			.onConflictDoUpdate({
				target: [googleCalendars.workspaceId, googleCalendars.googleId],
				set: {
					name: own ? OWN_CALENDAR : (c.summaryOverride ?? c.summary),
					color: c.backgroundColor ?? null,
					writable: c.accessRole === "owner" || c.accessRole === "writer",
					own,
				},
			});
	}
	const ids = list.map((c) => c.id);
	const rows = await db
		.select({ id: googleCalendars.id, googleId: googleCalendars.googleId })
		.from(googleCalendars)
		.where(eq(googleCalendars.workspaceId, account.workspaceId));
	const gone = rows.filter((r) => !ids.includes(r.googleId)).map((r) => r.id);
	if (gone.length > 0) await db.delete(googleCalendars).where(inArray(googleCalendars.id, gone));
	return ownId;
}

const instant = (day: string) => `${day}T00:00:00Z`;

/** Every shown calendar's events in the window, replacing what was kept. */
async function pullShown(api: CalendarApi, workspaceId: string, timeZone: string) {
	const today = dayIn(timeZone);
	const calendars = await db
		.select()
		.from(googleCalendars)
		.where(
			and(
				eq(googleCalendars.workspaceId, workspaceId),
				eq(googleCalendars.shown, true),
				eq(googleCalendars.own, false),
			),
		);
	for (const c of calendars) {
		const events = await api.events(c.googleId, {
			timeMin: instant(addDays(today, -PULL_BACK)),
			timeMax: instant(addDays(today, PULL_AHEAD)),
		});
		const rows = events.flatMap((e) => fromGoogle(e, timeZone) ?? []);
		await db.transaction(async (tx) => {
			await tx.delete(googleEvents).where(eq(googleEvents.calendarId, c.id));
			if (rows.length > 0)
				await tx
					.insert(googleEvents)
					.values(rows.map((r) => ({ ...r, calendarId: c.id, workspaceId })))
					.onConflictDoNothing();
		});
	}
	// A calendar switched off keeps nothing.
	const hidden = await db
		.select({ id: googleCalendars.id })
		.from(googleCalendars)
		.where(and(eq(googleCalendars.workspaceId, workspaceId), eq(googleCalendars.shown, false)));
	if (hidden.length > 0)
		await db.delete(googleEvents).where(
			inArray(
				googleEvents.calendarId,
				hidden.map((h) => h.id),
			),
		);
}

/** seikatsu's rows that belong in Google now, by key. */
async function mirrorItems(workspaceId: string, today: string): Promise<MirrorItem[]> {
	const [ws] = await db
		.select({ id: workspaces.id, modulesOff: workspaces.modulesOff })
		.from(workspaces)
		.where(eq(workspaces.id, workspaceId));
	if (!ws) return [];
	const from = addDays(today, -PUSH_BACK);
	const to = addDays(today, PUSH_AHEAD);
	const days: string[] = [];
	for (let d = from; d <= to; d = addDays(d, 1)) days.push(d);
	const [data, events] = await Promise.all([
		getWeekData(ws, today, days, modulesOn(ws.modulesOff)),
		readEvents(workspaceId, from, to),
	]);
	const base = origin();
	const items: MirrorItem[] = events.map((e) => ({
		key: `event:${e.id}`,
		title: e.title,
		date: e.date,
		endDate: e.endDate,
		startTime: e.startTime,
		endTime: e.endTime,
		note: e.note,
		recurrence: rruleOf(e),
		link: `${base}/?v=day&d=${e.date}`,
	}));
	for (const c of data.cardsDue)
		items.push({
			key: `seiryu:${c.id}`,
			title: c.title,
			date: c.date,
			startTime: c.time ?? null,
			note: c.projectName,
			link: `${base}/seiryu/${c.projectId}/${c.id}`,
		});
	for (const j of data.jobs)
		if ((j.what === "screening" || j.what === "interview") && j.id && j.date >= today)
			items.push({
				key: `kyuu:${j.id}:${j.date}:${j.what}`,
				title: `${j.what === "interview" ? "Interview" : "Screening"} · ${j.company}`,
				date: j.date,
				startTime: j.time ?? null,
				link: `${base}/kyuu/${j.id}`,
			});
	for (const c of data.car)
		items.push({
			key: `aisha:${c.date}:${c.name}`,
			title: `${c.name} due`,
			date: c.date,
			link: `${base}/aisha`,
		});
	for (const b of data.bills)
		items.push({
			key: `bill:${b.date}:${b.title}`,
			title: b.title,
			date: b.date,
			note: `${b.amount} ${b.currency} · recurring`,
			link: `${base}/kuroji`,
		});
	return items;
}

/** seikatsu's rows ⇄ its own Google calendar. */
async function mirror(api: CalendarApi, workspaceId: string, ownId: string, timeZone: string) {
	const today = dayIn(timeZone);
	const [ws] = await db
		.select({ userId: workspaces.userId })
		.from(workspaces)
		.where(eq(workspaces.id, workspaceId));
	if (!ws) return;
	const actor = { userId: ws.userId, name: null, timeZone };
	let rows = await db.select().from(googleMirror).where(eq(googleMirror.workspaceId, workspaceId));
	const byKey = new Map(rows.map((r) => [r.key, r]));

	// What the user changed in Google comes back first, so the push below sends the result.
	const inGoogle = await api.mirrored(ownId);
	for (const e of inGoogle) {
		if (e.recurringEventId) continue; // one day of a repeating event: not kept apart
		const key = e.extendedProperties?.private?.seikatsuKey;
		if (!key) {
			if (e.status !== "cancelled") await adopt(api, ownId, e, workspaceId, timeZone, actor);
			continue;
		}
		const row = byKey.get(key);
		if (!row || row.googleId !== e.id) continue;
		if (e.status === "cancelled") {
			await actAs(actor, () => removedInGoogle(key));
			await db
				.delete(googleMirror)
				.where(and(eq(googleMirror.workspaceId, workspaceId), eq(googleMirror.key, key)));
			byKey.delete(key);
			continue;
		}
		if (!e.updated || e.updated <= row.updated) continue;
		const applied = await actAs(actor, () => changedInGoogle(key, e, timeZone, workspaceId));
		await db
			.update(googleMirror)
			// Not applied (a row only seikatsu changes): sent again as it is here.
			.set({ updated: e.updated, ...(applied ? {} : { hash: "" }) })
			.where(and(eq(googleMirror.workspaceId, workspaceId), eq(googleMirror.key, key)));
	}

	rows = await db.select().from(googleMirror).where(eq(googleMirror.workspaceId, workspaceId));
	const sent = new Map(rows.map((r) => [r.key, r]));
	const items = await mirrorItems(workspaceId, today);
	const wanted = new Set(items.map((i) => i.key));
	for (const item of items) {
		const body = toGoogle(item, timeZone);
		const hash = hashOf(body);
		const row = sent.get(item.key);
		if (row && row.hash === hash) continue;
		let written: GoogleEvent | null = null;
		if (row)
			written = await api.patch(ownId, row.googleId, body).catch((err) => {
				if (
					(err as { status?: number }).status === 404 ||
					(err as { status?: number }).status === 410
				)
					return null;
				throw err;
			});
		written ??= await api.insert(ownId, body);
		await db
			.insert(googleMirror)
			.values({
				workspaceId,
				key: item.key,
				googleId: written.id,
				date: item.date,
				hash,
				updated: written.updated ?? new Date().toISOString(),
			})
			.onConflictDoUpdate({
				target: [googleMirror.workspaceId, googleMirror.key],
				set: {
					googleId: written.id,
					date: item.date,
					hash,
					updated: written.updated ?? new Date().toISOString(),
				},
			});
	}
	// Gone from seikatsu (done, deleted, moved off): gone from Google. Rows before the window
	// stay as history.
	const windowStart = addDays(today, -PUSH_BACK);
	for (const row of rows) {
		if (wanted.has(row.key)) continue;
		if (row.date < windowStart) {
			// History stays; only an event of the user's that's gone (a repeating one starts
			// long before) is taken off.
			const id = row.key.startsWith("event:") ? row.key.slice("event:".length) : null;
			if (!id || (await readEvent(workspaceId, id))) continue;
		}
		await api.remove(ownId, row.googleId);
		await db
			.delete(googleMirror)
			.where(and(eq(googleMirror.workspaceId, workspaceId), eq(googleMirror.key, row.key)));
	}
}

/** A row deleted in Google: an event goes; a card loses its due day; the rest come back. */
async function removedInGoogle(key: string) {
	const [kind, id] = key.split(":");
	if (kind === "event" && id) await deleteEvent({ id });
	else if (kind === "seiryu" && id) await updateCard({ cardId: id, dueDate: null });
}

/** A row changed in Google, applied through its app; false when only seikatsu changes it. */
async function changedInGoogle(
	key: string,
	e: GoogleEvent,
	timeZone: string,
	workspaceId: string,
): Promise<boolean> {
	const edit = editOf(e, timeZone);
	if (!edit) return false;
	const [kind, id] = key.split(":");
	if (kind === "event" && id) {
		const event = await readEvent(workspaceId, id);
		if (!event) return false;
		const result = await saveEvent({
			...event,
			title: edit.title,
			date: edit.date,
			endDate: edit.endDate,
			startTime: edit.startTime,
			endTime: edit.startTime ? edit.endTime : null,
			note: edit.note,
		});
		return !("error" in result);
	}
	if (kind === "seiryu" && id) {
		const result = await updateCard({
			cardId: id,
			title: edit.title,
			dueDate: edit.date,
			dueTime: edit.startTime,
		});
		return !("error" in result);
	}
	return false;
}

/** An event the user added straight to seikatsu's calendar in Google: one of their own now. */
async function adopt(
	api: CalendarApi,
	ownId: string,
	e: GoogleEvent,
	workspaceId: string,
	timeZone: string,
	actor: { userId: string; name: null; timeZone: string },
) {
	const row = editOf(e, timeZone);
	if (!row) return;
	const id = crypto.randomUUID();
	const result = await actAs(actor, () =>
		saveEvent({
			id,
			title: row.title,
			date: row.date,
			endDate: row.endDate,
			startTime: row.startTime,
			endTime: row.startTime ? row.endTime : null,
			repeat: null,
			repeatEvery: 1,
			repeatUntil: null,
			note: row.note,
		}),
	);
	if ("error" in result) return;
	// Marked as seikatsu's, so the push finds it instead of writing a copy.
	const marked = await api.patch(ownId, e.id, {
		extendedProperties: { private: { seikatsuKey: `event:${id}` } },
	});
	await db.insert(googleMirror).values({
		workspaceId,
		key: `event:${id}`,
		googleId: e.id,
		date: row.date,
		hash: "",
		updated: marked.updated ?? new Date().toISOString(),
	});
}

// ── Reads for the calendar ───────────────────────────────────────────────────

export type GoogleRow = CachedEvent & {
	calendarId: string;
	calendarName: string;
	color: string | null;
	writable: boolean;
};

/** The shown calendars' events that touch `from`…`to`. */
export async function readGoogleEvents(
	workspaceId: string,
	from: string,
	to: string,
): Promise<GoogleRow[]> {
	const rows = await db
		.select({
			event: googleEvents,
			calendarName: googleCalendars.name,
			color: googleCalendars.color,
			writable: googleCalendars.writable,
		})
		.from(googleEvents)
		.innerJoin(googleCalendars, eq(googleCalendars.id, googleEvents.calendarId))
		.where(
			and(
				eq(googleEvents.workspaceId, workspaceId),
				eq(googleCalendars.shown, true),
				lte(googleEvents.date, to),
				or(gte(googleEvents.date, from), gte(googleEvents.endDate, from)),
			),
		);
	return rows.map(({ event: e, calendarName, color, writable }) => ({
		googleId: e.googleId,
		title: e.title,
		date: e.date,
		endDate: e.endDate,
		startTime: e.startTime?.slice(0, 5) ?? null,
		endTime: e.endTime?.slice(0, 5) ?? null,
		location: e.location,
		note: e.note,
		link: e.link,
		recurring: e.recurring,
		calendarId: e.calendarId,
		calendarName,
		color,
		writable,
	}));
}
