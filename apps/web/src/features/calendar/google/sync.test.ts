import * as schema from "@seikatsu/db/schema";
import { createTestDb } from "@seikatsu/db/test-utils";
import * as ops from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { GoogleEvent } from "./map";

// Two-way sync against an in-memory Google: seikatsu's rows go out once, an edit made in Google
// comes back through the app's own action, a new event added there is adopted, and a shown
// calendar's events are kept on the user's clock.

let testDb: Awaited<ReturnType<typeof createTestDb>>;
let ws: typeof schema.workspaces.$inferSelect;

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/server", () => ({ after: vi.fn() }));
vi.mock("@sentry/nextjs", () => ({ captureException: (e: unknown) => console.error(e) }));
vi.mock("@seikatsu/db", async () => ({
	...schema,
	...ops,
	get db() {
		return testDb;
	},
}));
vi.mock("@/lib/session", () => ({
	requireWorkspace: async () => ws,
	getCurrentWorkspace: async () => ws,
}));
vi.mock("@/lib/seal", () => ({ seal: (s: string) => s, unseal: (s: string) => s }));

const cardUpdates: unknown[] = [];
vi.mock("@/features/seiryu/actions/cards", () => ({
	updateCard: async (input: unknown) => {
		cardUpdates.push(input);
		return { success: true };
	},
}));

// ── A Google of our own ──────────────────────────────────────────────────────
let clock = Date.parse("2026-11-25T10:00:00Z");
function stamp() {
	clock += 1000;
	return new Date(clock).toISOString();
}
const store = new Map<string, Map<string, GoogleEvent>>();
const writes = { insert: 0, patch: 0, remove: 0 };
let created = 0;
const OWN = "seikatsu-cal";
const WORK = "work@group.calendar.google.com";

function cal(id: string) {
	let c = store.get(id);
	if (!c) {
		c = new Map();
		store.set(id, c);
	}
	return c;
}

const fake = {
	calendars: async () => [
		{ id: WORK, summary: "Work", backgroundColor: "#4285f4", accessRole: "writer" },
		...(store.has(OWN) ? [{ id: OWN, summary: "seikatsu", accessRole: "owner" }] : []),
	],
	createCalendar: async () => {
		created++;
		cal(OWN);
		return { id: OWN };
	},
	events: async (id: string) => [...cal(id).values()].filter((e) => e.status !== "cancelled"),
	mirrored: async (id: string) => [...cal(id).values()],
	insert: async (id: string, body: GoogleEvent) => {
		writes.insert++;
		const e = {
			...body,
			id: `g${cal(id).size + 1}`,
			updated: stamp(),
			status: "confirmed" as const,
		};
		cal(id).set(e.id, e);
		return e;
	},
	patch: async (id: string, eventId: string, body: Partial<GoogleEvent>) => {
		writes.patch++;
		const prev = cal(id).get(eventId);
		if (!prev) throw Object.assign(new Error("gone"), { status: 404 });
		const e = {
			...prev,
			...body,
			extendedProperties: body.extendedProperties ?? prev.extendedProperties,
			updated: stamp(),
		};
		cal(id).set(eventId, e);
		return e;
	},
	remove: async (id: string, eventId: string) => {
		writes.remove++;
		const prev = cal(id).get(eventId);
		if (prev) cal(id).set(eventId, { ...prev, status: "cancelled", updated: stamp() });
	},
};
vi.mock("@/features/calendar/google/api", () => ({
	calendarApi: () => fake,
	tokenFor: async () => "token",
}));

/** The user changing something in Google's own app. */
function userEdits(id: string, eventId: string, change: Partial<GoogleEvent>) {
	const prev = cal(id).get(eventId);
	if (!prev) throw new Error(`no ${eventId}`);
	cal(id).set(eventId, { ...prev, ...change, updated: stamp() });
}

const ownEvents = () => [...cal(OWN).values()].filter((e) => e.status !== "cancelled");
const byKey = (key: string) =>
	ownEvents().find((e) => e.extendedProperties?.private?.seikatsuKey === key);

const { syncGoogle } = await import("./sync");

let eventId: string;
let cardId: string;

beforeAll(async () => {
	vi.useFakeTimers({ toFake: ["Date"] });
	vi.setSystemTime(new Date("2026-11-25T10:00:00Z"));
	testDb = await createTestDb();
	[ws] = await testDb
		.insert(schema.workspaces)
		.values({ userId: "user-1", name: "Test", baseCurrency: "PLN" })
		.returning();
	await testDb.insert(schema.googleAccounts).values({
		workspaceId: ws.id,
		email: "me@example.com",
		refreshToken: "r",
		timeZone: "Europe/Warsaw",
	});
	const [event] = await testDb
		.insert(schema.calendarEvents)
		.values({
			workspaceId: ws.id,
			title: "Dentist",
			date: "2026-11-27",
			startTime: "15:00",
			endTime: "16:00",
		})
		.returning();
	eventId = event.id;
	const [project] = await testDb
		.insert(schema.seiryuProjects)
		.values({ workspaceId: ws.id, name: "Home", position: "a0" })
		.returning();
	const [todo] = await testDb
		.insert(schema.seiryuColumns)
		.values({ projectId: project.id, name: "Todo", position: "a0" })
		.returning();
	const [card] = await testDb
		.insert(schema.seiryuCards)
		.values({
			projectId: project.id,
			columnId: todo.id,
			title: "Call the garage",
			position: "a0",
			dueDate: "2026-11-26",
		})
		.returning();
	cardId = card.id;
	cal(WORK).set("w1", {
		id: "w1",
		summary: "Standup",
		status: "confirmed",
		start: { dateTime: "2026-11-26T08:30:00Z" },
		end: { dateTime: "2026-11-26T08:45:00Z" },
	});
}, 30_000);

describe("syncGoogle", () => {
	it("takes up a seikatsu calendar Google made on a first sync cut short", async () => {
		// Google made the calendar, but the answer never came back: nothing noted here.
		cal(OWN);
		await syncGoogle(ws.id);
		expect(created).toBe(0);
		const [account] = await testDb.select().from(schema.googleAccounts);
		expect(account?.ownCalendarId).toBe(OWN);
	});

	it("writes seikatsu's rows to its own calendar and pulls the shown ones", async () => {
		await syncGoogle(ws.id);
		expect(byKey(`event:${eventId}`)).toMatchObject({
			summary: "Dentist",
			start: { dateTime: "2026-11-27T15:00:00", timeZone: "Europe/Warsaw" },
		});
		expect(byKey(`seiryu:${cardId}`)).toMatchObject({
			summary: "Call the garage",
			start: { date: "2026-11-26" },
		});
		const pulled = await testDb.select().from(schema.googleEvents);
		expect(pulled).toMatchObject([
			{ title: "Standup", date: "2026-11-26", startTime: "09:30:00", endTime: "09:45:00" },
		]);
	});

	it("writes nothing again when nothing changed", async () => {
		const before = { ...writes };
		await syncGoogle(ws.id);
		expect(writes).toEqual(before);
	});

	it("brings an edit made in Google back through the app's own action", async () => {
		const dentist = byKey(`event:${eventId}`);
		const call = byKey(`seiryu:${cardId}`);
		if (!dentist || !call) throw new Error("not mirrored");
		userEdits(OWN, dentist.id, {
			summary: "Dentist, Dr Nowak",
			start: { dateTime: "2026-11-28T09:00:00+01:00" },
			end: { dateTime: "2026-11-28T10:30:00+01:00" },
		});
		userEdits(OWN, call.id, {
			start: { dateTime: "2026-11-30T14:00:00+01:00" },
			end: { dateTime: "2026-11-30T15:00:00+01:00" },
		});
		await syncGoogle(ws.id);
		const [saved] = await testDb
			.select()
			.from(schema.calendarEvents)
			.where(ops.eq(schema.calendarEvents.id, eventId));
		expect(saved).toMatchObject({
			title: "Dentist, Dr Nowak",
			date: "2026-11-28",
			startTime: "09:00:00",
			endTime: "10:30:00",
		});
		expect(cardUpdates.at(-1)).toMatchObject({
			cardId,
			dueDate: "2026-11-30",
			dueTime: "14:00",
		});
	});

	it("takes a card's row deleted in Google as no due day", async () => {
		const call = byKey(`seiryu:${cardId}`);
		if (!call) throw new Error("not mirrored");
		await fake.remove(OWN, call.id);
		await syncGoogle(ws.id);
		expect(cardUpdates.at(-1)).toEqual({ cardId, dueDate: null });
	});

	it("adopts an event added straight to seikatsu's calendar", async () => {
		cal(OWN).set("u1", {
			id: "u1",
			summary: "Olya's birthday",
			status: "confirmed",
			updated: stamp(),
			start: { date: "2026-12-03" },
			end: { date: "2026-12-04" },
		});
		await syncGoogle(ws.id);
		const events = await testDb.select().from(schema.calendarEvents);
		const adopted = events.find((e) => e.title === "Olya's birthday");
		expect(adopted).toMatchObject({ date: "2026-12-03", startTime: null });
		expect(cal(OWN).get("u1")?.extendedProperties?.private?.seikatsuKey).toBe(
			`event:${adopted?.id}`,
		);
		// Not written a second time.
		expect(ownEvents().filter((e) => e.summary === "Olya's birthday")).toHaveLength(1);
	});

	it("takes an event deleted here off Google", async () => {
		await testDb.delete(schema.calendarEvents).where(ops.eq(schema.calendarEvents.id, eventId));
		await syncGoogle(ws.id);
		expect(byKey(`event:${eventId}`)).toBeUndefined();
	});
});
