import type { bankConnections } from "@seikatsu/db";
import { differenceInCalendarDays } from "date-fns";
import { formatShortDate, parseLocal } from "./dates";

/**
 * The cron syncs every connection once a day. Three calendar days without a sync means
 * at least two runs failed in a row: past a one-off bank hiccup, and the totals are
 * now visibly behind.
 */
export const STALE_AFTER_DAYS = 3;

type Connection = Pick<
	typeof bankConnections.$inferSelect,
	"displayName" | "status" | "accessExpiresAt" | "lastSyncedAt" | "createdAt"
>;

export type BankProblem = {
	/** expired: needs the user to reconnect. stale: still linked but not syncing. */
	kind: "expired" | "stale";
	name: string;
	/** Last sync as YYYY-MM-DD in the user's zone (expiry date if it never synced). */
	since: string | null;
	sinceLabel: string | null;
	message: string;
};

export type BankHealth = { kind: "ok" } | BankProblem;

const OK: BankHealth = { kind: "ok" };

function localDay(at: Date, timeZone: string): string {
	// en-CA formats as YYYY-MM-DD.
	return new Intl.DateTimeFormat("en-CA", {
		timeZone,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	}).format(at);
}

export function connectionHealth(c: Connection, now: Date, timeZone: string): BankHealth {
	// Still being authorized: nothing was promised yet, Settings shows it.
	if (c.status === "CREATED") return OK;

	const name = c.displayName;
	const today = localDay(now, timeZone);
	const lastDay = c.lastSyncedAt ? localDay(c.lastSyncedAt, timeZone) : null;

	const expired =
		c.status === "EXPIRED" || (c.accessExpiresAt !== null && c.accessExpiresAt <= now);
	if (expired) {
		const since = lastDay ?? (c.accessExpiresAt ? localDay(c.accessExpiresAt, timeZone) : null);
		const sinceLabel = since ? formatShortDate(since, today) : null;
		return {
			kind: "expired",
			name,
			since,
			sinceLabel,
			message: sinceLabel ? `${name} stopped syncing on ${sinceLabel}` : `${name} access expired`,
		};
	}

	const reference = lastDay ?? localDay(c.createdAt, timeZone);
	if (differenceInCalendarDays(parseLocal(today), parseLocal(reference)) < STALE_AFTER_DAYS) {
		return OK;
	}
	const sinceLabel = lastDay ? formatShortDate(lastDay, today) : null;
	return {
		kind: "stale",
		name,
		since: lastDay,
		sinceLabel,
		message: sinceLabel ? `${name} hasn't synced since ${sinceLabel}` : `${name} hasn't synced yet`,
	};
}

/** The one problem worth a line: an expired connection outranks a stale one. */
export function worstBankProblem(
	connections: Connection[],
	now: Date,
	timeZone: string,
): BankProblem | null {
	const problems = connections
		.map((c) => connectionHealth(c, now, timeZone))
		.filter((h): h is BankProblem => h.kind !== "ok");
	return problems.find((p) => p.kind === "expired") ?? problems[0] ?? null;
}

/** An empty period that starts after the last sync is the sync's fault, not the period's. */
export function periodAfterSync(problem: BankProblem, from: string | undefined): boolean {
	return !!from && !!problem.since && from > problem.since;
}
