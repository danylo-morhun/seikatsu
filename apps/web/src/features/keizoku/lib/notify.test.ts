import * as schema from "@seikatsu/db/schema";
import { createTestDb } from "@seikatsu/db/test-utils";
import * as ops from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

let testDb: Awaited<ReturnType<typeof createTestDb>>;

const sendNotification = vi.fn(async (..._args: unknown[]) => ({ statusCode: 201 }));
vi.mock("web-push", () => ({
	default: {
		setVapidDetails: vi.fn(),
		sendNotification: (...a: unknown[]) => sendNotification(...a),
	},
}));

// Real Postgres (PGlite, real migrations) in place of the network DB.
vi.mock("@seikatsu/db", async () => ({
	...schema,
	...ops,
	get db() {
		return testDb;
	},
}));

const { notifyKeizoku } = await import("./notify");

const SUNDAY = "2026-10-25";

async function seed() {
	await testDb.delete(schema.workspaces);
	const [ws] = await testDb
		.insert(schema.workspaces)
		.values({ userId: "user-1", name: "Test", baseCurrency: "USD" })
		.returning();
	const [prefs] = await testDb
		.insert(schema.notificationPrefs)
		.values({ workspaceId: ws.id, timeZone: "UTC", keizokuTime: "21:00" })
		.returning();
	await testDb.insert(schema.pushSubscriptions).values({
		workspaceId: ws.id,
		endpoint: "https://push.example/1",
		p256dh: "p",
		auth: "a",
	});
	const [run, read, gym] = await testDb
		.insert(schema.keizokuHabits)
		.values([
			{ workspaceId: ws.id, name: "Run", emoji: "🏃", frequencyType: "daily" },
			{ workspaceId: ws.id, name: "Read", emoji: "📖", frequencyType: "daily" },
			{
				workspaceId: ws.id,
				name: "Gym",
				emoji: "🏋️",
				frequencyType: "times_per_week",
				frequencyTarget: 2,
			},
		])
		.returning();
	return { ws, prefs, run, read, gym };
}

const at = (minutes: number) => ({ day: SUNDAY, minutes, weekday: 7 });

describe("notifyKeizoku", () => {
	beforeAll(async () => {
		testDb = await createTestDb();
		process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = "pub";
		process.env.VAPID_PRIVATE_KEY = "priv";
	});
	beforeEach(() => sendNotification.mockClear());

	it("sends the open habits once at the evening time", async () => {
		const { ws, prefs, run, gym } = await seed();
		await testDb.insert(schema.keizokuHabitLogs).values([
			{ habitId: run.id, date: SUNDAY },
			// Gym's weekly target (2) is met: Saturday + Friday.
			{ habitId: gym.id, date: "2026-10-24" },
			{ habitId: gym.id, date: "2026-10-23" },
		]);
		const ctx = { workspaceId: ws.id, prefs };

		expect(await notifyKeizoku({ ...ctx, clock: at(20 * 60 + 59) })).toBe(0);
		expect(await notifyKeizoku({ ...ctx, clock: at(21 * 60 + 5) })).toBe(1);
		// The next 15-minute run within the hour doesn't repeat it.
		expect(await notifyKeizoku({ ...ctx, clock: at(21 * 60 + 20) })).toBe(0);

		expect(sendNotification).toHaveBeenCalledTimes(1);
		const payload = JSON.parse(sendNotification.mock.calls[0][1] as string);
		expect(payload).toMatchObject({
			title: "One habit left today",
			body: "📖 Read",
			url: "/keizoku",
		});
	});

	it("stays quiet when everything is done or it's turned off", async () => {
		const { ws, prefs, run, read, gym } = await seed();
		await testDb
			.insert(schema.keizokuHabitLogs)
			.values([run, read, gym].map((h) => ({ habitId: h.id, date: SUNDAY })));
		await testDb
			.update(schema.keizokuHabits)
			.set({ frequencyTarget: 1 })
			.where(ops.eq(schema.keizokuHabits.id, gym.id));
		expect(await notifyKeizoku({ workspaceId: ws.id, prefs, clock: at(21 * 60) })).toBe(0);

		const off = { ...prefs, keizokuEnabled: false };
		await testDb.delete(schema.keizokuHabitLogs);
		expect(await notifyKeizoku({ workspaceId: ws.id, prefs: off, clock: at(21 * 60) })).toBe(0);
		expect(sendNotification).not.toHaveBeenCalled();
	});

	it("retries next run when no device took it, and drops dead devices", async () => {
		const { ws, prefs } = await seed();
		sendNotification.mockRejectedValueOnce(Object.assign(new Error("gone"), { statusCode: 410 }));

		expect(await notifyKeizoku({ workspaceId: ws.id, prefs, clock: at(21 * 60) })).toBe(0);
		expect(await testDb.select().from(schema.pushSubscriptions)).toHaveLength(0);
		expect(await testDb.select().from(schema.notificationLog)).toHaveLength(0);
	});
});
