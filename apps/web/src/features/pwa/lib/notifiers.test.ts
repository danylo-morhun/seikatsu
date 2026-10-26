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

// The cron has no session; modules beside the notifiers import auth and the cache.
vi.mock("@/auth", () => ({ auth: vi.fn(async () => null) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

// Real Postgres (PGlite, real migrations) in place of the network DB.
vi.mock("@seikatsu/db", async () => ({
	...schema,
	...ops,
	get db() {
		return testDb;
	},
}));

const { notifyKyuu } = await import("@/features/kyuu/lib/notify");
const { notifyAisha } = await import("@/features/aisha/lib/notify");
const { notifyKurojiBudget, notifyKurojiRecurring, notifyKurojiWeekly } = await import(
	"@/features/kuroji/lib/notify"
);

// Monday 2026-10-26, 09:10 local — past the default 09:00 morning time.
const DAY = "2026-10-26";
const MORNING = { day: DAY, minutes: 9 * 60 + 10, weekday: 1 };

const lastPayload = () =>
	JSON.parse(sendNotification.mock.calls.at(-1)?.[1] as string) as { title: string; body: string };

async function workspace() {
	// Ledger rows hold accounts without a cascade: clear them before the workspace.
	await testDb.delete(schema.transactions);
	await testDb.delete(schema.recurringTransactions);
	await testDb.delete(schema.workspaces);
	const [ws] = await testDb
		.insert(schema.workspaces)
		.values({ userId: "user-1", name: "Test", baseCurrency: "PLN" })
		.returning();
	const [prefs] = await testDb
		.insert(schema.notificationPrefs)
		.values({ workspaceId: ws.id })
		.returning();
	await testDb.insert(schema.pushSubscriptions).values({
		workspaceId: ws.id,
		endpoint: "https://push.example/1",
		p256dh: "p",
		auth: "a",
	});
	return { workspaceId: ws.id, prefs };
}

beforeAll(async () => {
	testDb = await createTestDb();
	process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = "pub";
	process.env.VAPID_PRIVATE_KEY = "priv";
});
beforeEach(() => sendNotification.mockClear());

describe("notifyKyuu", () => {
	it("sums up calls, follow-ups and ghosts in one morning push", async () => {
		const ctx = await workspace();
		const [acme, quiet, ghost] = await testDb
			.insert(schema.kyuuApplications)
			.values([
				{ workspaceId: ctx.workspaceId, company: "Acme", role: "Dev", dateApplied: "2026-10-20" },
				{ workspaceId: ctx.workspaceId, company: "Quiet", role: "Dev", dateApplied: "2026-10-15" },
				{ workspaceId: ctx.workspaceId, company: "Gone", role: "Dev", dateApplied: "2026-10-01" },
			])
			.returning();
		await testDb.insert(schema.kyuuEvents).values([
			{ applicationId: acme.id, kind: "interview", date: DAY, time: "14:00" },
			{ applicationId: acme.id, kind: "screening", date: "2026-10-22" },
		]);
		expect(quiet && ghost).toBeTruthy();

		expect(await notifyKyuu({ ...ctx, clock: { ...MORNING, minutes: 8 * 60 } })).toBe(0);
		expect(await notifyKyuu({ ...ctx, clock: MORNING })).toBe(1);
		expect(lastPayload()).toEqual(
			expect.objectContaining({
				title: "1 call today",
				body: "Acme today at 14:00 · 1 follow-up due · 1 application to close as ghosted",
			}),
		);
		expect(await notifyKyuu({ ...ctx, clock: MORNING })).toBe(0);
	});
});

describe("notifyAisha", () => {
	it("announces each document mark once", async () => {
		const ctx = await workspace();
		const [car] = await testDb
			.insert(schema.aishaVehicles)
			.values({
				workspaceId: ctx.workspaceId,
				make: "Skoda",
				model: "Octavia",
				year: 2019,
				fuelType: "petrol",
			})
			.returning();
		await testDb
			.insert(schema.aishaOdometerReadings)
			.values({ vehicleId: car.id, date: DAY, km: 90_000 });
		await testDb.insert(schema.aishaDocuments).values([
			{ vehicleId: car.id, type: "insurance", name: "OC", expiresOn: "2026-11-01" },
			{ vehicleId: car.id, type: "inspection", name: "Inspection", expiresOn: "2027-06-01" },
		]);

		expect(await notifyAisha({ ...ctx, clock: MORNING })).toBe(1);
		expect(lastPayload().body).toBe("OC expires in 6 days");
		expect(await notifyAisha({ ...ctx, clock: MORNING })).toBe(0);
		// Five days later it reaches the 1-day mark: told again.
		const later = { day: "2026-10-31", minutes: MORNING.minutes, weekday: 6 };
		expect(await notifyAisha({ ...ctx, clock: later })).toBe(1);
		expect(lastPayload().body).toBe("OC expires tomorrow");
	});
});

describe("Kuroji notifiers", () => {
	async function ledger() {
		const ctx = await workspace();
		const [bank, salary, food, netflix] = await testDb
			.insert(schema.accounts)
			.values([
				{ workspaceId: ctx.workspaceId, name: "Bank", type: "ASSET", currency: "PLN" },
				{ workspaceId: ctx.workspaceId, name: "Salary", type: "INCOME", currency: "PLN" },
				{
					workspaceId: ctx.workspaceId,
					name: "Food",
					type: "EXPENSE",
					currency: "PLN",
					budget: "1000",
				},
				{ workspaceId: ctx.workspaceId, name: "Netflix", type: "EXPENSE", currency: "PLN" },
			])
			.returning();
		async function txn(
			date: string,
			from: string,
			to: string,
			amount: number,
			description?: string,
		) {
			const [t] = await testDb
				.insert(schema.transactions)
				.values({ workspaceId: ctx.workspaceId, date, description })
				.returning();
			await testDb.insert(schema.transactionEntries).values([
				{
					transactionId: t.id,
					accountId: from,
					amount: String(-amount),
					currency: "PLN",
					baseAmount: String(-amount),
				},
				{
					transactionId: t.id,
					accountId: to,
					amount: String(amount),
					currency: "PLN",
					baseAmount: String(amount),
				},
			]);
		}
		return { ctx, bank, salary, food, netflix, txn };
	}

	it("tells the recurring posted today", async () => {
		const { ctx, bank, netflix, txn } = await ledger();
		await testDb.insert(schema.recurringTransactions).values({
			workspaceId: ctx.workspaceId,
			fromAccountId: bank.id,
			toAccountId: netflix.id,
			amount: "45",
			currency: "PLN",
			description: "Netflix",
			frequency: "monthly",
			nextDate: "2026-11-26",
		});
		await txn(DAY, bank.id, netflix.id, 45, "Netflix");

		expect(await notifyKurojiRecurring({ ...ctx, clock: MORNING })).toBe(1);
		expect(lastPayload().title).toBe("Recurring posted");
		expect(lastPayload().body).toContain("Netflix");
	});

	it("alerts at 80% and again at 100% of a budget", async () => {
		const { ctx, bank, food, txn } = await ledger();
		const noon = { ...MORNING, minutes: 12 * 60 };
		await txn("2026-10-05", bank.id, food.id, 850);
		expect(await notifyKurojiBudget({ ...ctx, clock: noon })).toBe(1);
		expect(lastPayload().title).toBe("Budget nearly used");
		expect(await notifyKurojiBudget({ ...ctx, clock: noon })).toBe(0);

		await txn("2026-10-20", bank.id, food.id, 200);
		// Not at night.
		expect(await notifyKurojiBudget({ ...ctx, clock: { ...noon, minutes: 23 * 60 } })).toBe(0);
		expect(await notifyKurojiBudget({ ...ctx, clock: noon })).toBe(1);
		expect(lastPayload().title).toBe("Over budget");
	});

	it("sums up last week on Monday", async () => {
		const { ctx, bank, salary, food, txn } = await ledger();
		await txn("2026-10-20", salary.id, bank.id, 5000);
		await txn("2026-10-22", bank.id, food.id, 300);
		await txn(DAY, bank.id, food.id, 999); // this week — not counted

		expect(await notifyKurojiWeekly({ ...ctx, clock: { ...MORNING, weekday: 2 } })).toBe(0);
		expect(await notifyKurojiWeekly({ ...ctx, clock: MORNING })).toBe(1);
		const { body } = lastPayload();
		expect(body).toMatch(/^Spent 300,00\s?zł · Earned 5\s?000,00\s?zł · Net 4\s?700,00\s?zł$/);
	});
});
