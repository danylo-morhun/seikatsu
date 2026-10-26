import * as schema from "@seikatsu/db/schema";
import { createTestDb } from "@seikatsu/db/test-utils";
import * as ops from "drizzle-orm";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { MailMessage } from "../lib/mail-match";

let testDb: Awaited<ReturnType<typeof createTestDb>>;

// Real Postgres (PGlite, real migrations) in place of the network DB.
vi.mock("@seikatsu/db", async () => ({
	...schema,
	...ops,
	get db() {
		return testDb;
	},
}));

const askGemini = vi.fn();
vi.mock("../lib/gemini", () => ({
	askGemini: (...args: unknown[]) => askGemini(...args),
}));

const { syncMail } = await import("./mail-sync");

const mail = (over: Partial<MailMessage>): MailMessage => ({
	id: "m1",
	threadId: "t1",
	from: "Someone <someone@example.com>",
	subject: "",
	date: "2026-10-20T10:00:00Z",
	day: "2026-10-20",
	body: "",
	...over,
});

async function seed() {
	const [workspace] = await testDb
		.insert(schema.workspaces)
		.values({ userId: "user-1", name: "Test", baseCurrency: "USD" })
		.returning();
	const [acme, globex] = await testDb
		.insert(schema.kyuuApplications)
		.values([
			{ workspaceId: workspace.id, company: "Acme", role: "Frontend", dateApplied: "2026-10-01" },
			{ workspaceId: workspace.id, company: "Globex", role: "React", dateApplied: "2026-10-05" },
		])
		.returning();
	return { workspace, acme, globex };
}

const verdict = (over: Record<string, unknown>) => ({
	match: "0",
	kind: "rejected",
	confident: true,
	date: null,
	time: null,
	summary: "Acme passed",
	...over,
});

const eventsOf = (applicationId: string) =>
	testDb
		.select()
		.from(schema.kyuuEvents)
		.where(ops.eq(schema.kyuuEvents.applicationId, applicationId));

const statusOf = async (id: string) =>
	(
		await testDb
			.select({ status: schema.kyuuApplications.status })
			.from(schema.kyuuApplications)
			.where(ops.eq(schema.kyuuApplications.id, id))
	)[0]?.status;

describe("syncMail", () => {
	beforeAll(async () => {
		testDb = await createTestDb();
	}, 30_000);

	afterEach(async () => {
		askGemini.mockReset();
		await testDb.delete(schema.kyuuMail);
		await testDb.delete(schema.kyuuApplications);
		await testDb.delete(schema.workspaces);
	});

	it("skips mail about nothing it knows without asking Gemini, once", async () => {
		const { workspace } = await seed();
		const news = mail({ subject: "Your weekly newsletter" });
		const first = await syncMail(workspace.id, [news], null);
		expect(first).toMatchObject({ read: 0, applied: 0, review: 0 });
		expect(askGemini).not.toHaveBeenCalled();
		const rows = await testDb.select().from(schema.kyuuMail);
		expect(rows).toEqual([expect.objectContaining({ state: "skipped", sender: null })]);
	});

	it("logs a clear answer on its application and moves the status", async () => {
		const { workspace, acme } = await seed();
		askGemini.mockResolvedValue(verdict({}));
		const result = await syncMail(
			workspace.id,
			[mail({ subject: "Your application at Acme", body: "Unfortunately…" })],
			"me@gmail.com",
		);
		expect(result.applied).toBe(1);
		expect(await statusOf(acme.id)).toBe("rejected");
		const [event] = await eventsOf(acme.id);
		expect(event).toMatchObject({
			kind: "rejected",
			date: "2026-10-20",
			note: "Acme passed · from mail",
		});
		const [row] = await testDb.select().from(schema.kyuuMail);
		expect(row).toMatchObject({ state: "applied", eventId: event.id, previousStatus: "applied" });
		expect(row.link).toContain("authuser=me%40gmail.com#all/t1");

		// The script sends the same days again: nothing is read twice.
		const again = await syncMail(
			workspace.id,
			[mail({ subject: "Your application at Acme" })],
			null,
		);
		expect(again.read).toBe(0);
		expect(askGemini).toHaveBeenCalledTimes(1);
	});

	it("books a screen on the day the mail names", async () => {
		const { workspace, acme } = await seed();
		askGemini.mockResolvedValue(verdict({ kind: "screening", date: "2026-10-23", time: "14:30" }));
		await syncMail(workspace.id, [mail({ subject: "Acme — intro call" })], null);
		expect(await statusOf(acme.id)).toBe("hr_screening");
		const [event] = await eventsOf(acme.id);
		expect(event).toMatchObject({ kind: "screening", date: "2026-10-23", time: "14:30:00" });
	});

	it("leaves unsure answers for review", async () => {
		const { workspace, acme } = await seed();
		askGemini.mockResolvedValue(verdict({ confident: false }));
		const result = await syncMail(workspace.id, [mail({ subject: "Acme update" })], null);
		expect(result.review).toBe(1);
		expect(await statusOf(acme.id)).toBe("applied");
		expect(await eventsOf(acme.id)).toEqual([]);
		const [row] = await testDb.select().from(schema.kyuuMail);
		expect(row).toMatchObject({ state: "review", applicationId: acme.id, kind: "rejected" });
	});

	it("doesn't log a second rejection from the same thread", async () => {
		const { workspace, acme } = await seed();
		askGemini.mockResolvedValue(verdict({}));
		await syncMail(workspace.id, [mail({ id: "a", subject: "Acme" })], null);
		await syncMail(workspace.id, [mail({ id: "b", subject: "Re: Acme" })], null);
		expect(await eventsOf(acme.id)).toHaveLength(1);
	});

	it("leaves what needs Gemini for the next run when it fails, and puts the rest away", async () => {
		const { workspace } = await seed();
		askGemini.mockRejectedValue(new Error("503"));
		const result = await syncMail(
			workspace.id,
			[
				mail({ id: "a", subject: "Acme", date: "2026-10-20T09:00:00Z" }),
				mail({ id: "b", subject: "Globex", date: "2026-10-20T10:00:00Z" }),
				mail({ id: "c", subject: "Newsletter", date: "2026-10-20T11:00:00Z" }),
			],
			null,
		);
		expect(result).toMatchObject({ read: 0, deferred: 2 });
		// Gemini isn't asked again once it's down.
		expect(askGemini).toHaveBeenCalledTimes(1);
		const rows = await testDb.select().from(schema.kyuuMail);
		expect(rows.map((r) => [r.messageId, r.state])).toEqual([["c", "skipped"]]);
	});

	it("asks only about the applications the mail names", async () => {
		const { workspace, globex } = await seed();
		askGemini.mockResolvedValue(verdict({ kind: "none" }));
		await syncMail(workspace.id, [mail({ subject: "Globex: next steps" })], null);
		const [prompt] = askGemini.mock.calls[0] as [string];
		expect(prompt).toContain("#0 Globex — React");
		expect(prompt).not.toContain("Acme");
		expect(await statusOf(globex.id)).toBe("applied");
	});
});
