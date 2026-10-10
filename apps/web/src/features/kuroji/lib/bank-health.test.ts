import { describe, expect, it } from "vitest";
import { connectionHealth, periodAfterSync, worstBankProblem } from "./bank-health";

const TZ = "Europe/Warsaw";
const now = new Date("2026-10-10T12:00:00Z");

const base = {
	displayName: "Pekao",
	status: "LINKED" as const,
	accessExpiresAt: new Date("2027-01-01T00:00:00Z"),
	lastSyncedAt: new Date("2026-10-10T06:01:00Z"),
	createdAt: new Date("2026-06-01T10:00:00Z"),
};

describe("connectionHealth", () => {
	it("is ok after today's sync", () => {
		expect(connectionHealth(base, now, TZ)).toEqual({ kind: "ok" });
	});

	it("tolerates one missed daily run", () => {
		const c = { ...base, lastSyncedAt: new Date("2026-10-08T06:01:00Z") };
		expect(connectionHealth(c, now, TZ).kind).toBe("ok");
	});

	it("is stale after three days without a sync", () => {
		const c = { ...base, lastSyncedAt: new Date("2026-10-07T06:01:00Z") };
		expect(connectionHealth(c, now, TZ)).toMatchObject({
			kind: "stale",
			since: "2026-10-07",
			message: "Pekao hasn't synced since Oct 7",
		});
	});

	it("treats a failing connection by age, like a linked one", () => {
		const recent = { ...base, status: "ERROR" as const };
		expect(connectionHealth(recent, now, TZ).kind).toBe("ok");
		const old = { ...recent, lastSyncedAt: new Date("2026-09-30T06:00:00Z") };
		expect(connectionHealth(old, now, TZ).kind).toBe("stale");
	});

	it("is expired by status, dated by the last sync", () => {
		const c = {
			...base,
			status: "EXPIRED" as const,
			lastSyncedAt: new Date("2026-09-11T06:57:11Z"),
		};
		expect(connectionHealth(c, now, TZ)).toMatchObject({
			kind: "expired",
			since: "2026-09-11",
			message: "Pekao stopped syncing on Sep 11",
		});
	});

	it("is expired once the consent window lapses, before the status catches up", () => {
		const c = { ...base, accessExpiresAt: new Date("2026-10-09T00:00:00Z") };
		expect(connectionHealth(c, now, TZ).kind).toBe("expired");
	});

	it("falls back to the expiry date when it never synced", () => {
		const c = {
			...base,
			status: "EXPIRED" as const,
			lastSyncedAt: null,
			accessExpiresAt: new Date("2025-12-01T00:00:00Z"),
		};
		expect(connectionHealth(c, now, TZ)).toMatchObject({
			since: "2025-12-01",
			message: "Pekao stopped syncing on Dec 1, 2025",
		});
	});

	it("dates the sync in the user's zone", () => {
		// 23:30 UTC on Sep 10 is already Sep 11 in Warsaw.
		const c = {
			...base,
			status: "EXPIRED" as const,
			lastSyncedAt: new Date("2026-09-10T23:30:00Z"),
		};
		expect(connectionHealth(c, now, TZ)).toMatchObject({ since: "2026-09-11" });
	});

	it("ignores a connection still awaiting authorization", () => {
		const c = { ...base, status: "CREATED" as const, lastSyncedAt: null };
		expect(connectionHealth(c, now, TZ).kind).toBe("ok");
	});
});

describe("worstBankProblem", () => {
	const stale = { ...base, displayName: "mBank", lastSyncedAt: new Date("2026-10-01T06:00:00Z") };
	const expired = { ...base, status: "EXPIRED" as const };

	it("is null when every connection is fine", () => {
		expect(worstBankProblem([base], now, TZ)).toBeNull();
	});

	it("puts an expired connection before a stale one", () => {
		expect(worstBankProblem([stale, expired], now, TZ)?.kind).toBe("expired");
	});
});

describe("periodAfterSync", () => {
	const problem = connectionHealth(
		{ ...base, status: "EXPIRED", lastSyncedAt: new Date("2026-09-11T06:57:11Z") },
		now,
		TZ,
	);
	if (problem.kind === "ok") throw new Error("expected a problem");

	it("blames the sync for a period that starts after it", () => {
		expect(periodAfterSync(problem, "2026-10-01")).toBe(true);
	});

	it("does not for a period that covers the last sync", () => {
		expect(periodAfterSync(problem, "2026-09-01")).toBe(false);
	});

	it("does not for all time", () => {
		expect(periodAfterSync(problem, undefined)).toBe(false);
	});
});
