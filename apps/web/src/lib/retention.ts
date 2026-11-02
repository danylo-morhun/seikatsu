// Server-only: deletes bookkeeping rows nobody reads after a while. Run by the daily cron.

import { and, db, lt, notificationLog, notLike, outboxReceipts } from "@seikatsu/db";

const DAY = 24 * 60 * 60 * 1000;

/**
 * Outbox receipts only stop a retried replay from running twice; retries come within days.
 * Send-once keys are mostly per day or month. Aisha's aren't: an overdue item or an expired
 * document keeps the same key while it stays that way, so dropping it would send the reminder
 * again. Those stay (a few rows per item).
 */
export const RETENTION_DAYS = { outboxReceipts: 30, notificationLog: 90 } as const;

export async function pruneOldRows(now = new Date()) {
	const before = (days: number) => new Date(now.getTime() - days * DAY);
	const [receipts, notifications] = await Promise.all([
		db
			.delete(outboxReceipts)
			.where(lt(outboxReceipts.createdAt, before(RETENTION_DAYS.outboxReceipts)))
			.returning({ id: outboxReceipts.opId }),
		db
			.delete(notificationLog)
			.where(
				and(
					lt(notificationLog.sentAt, before(RETENTION_DAYS.notificationLog)),
					notLike(notificationLog.key, "aisha:%"),
				),
			)
			.returning({ key: notificationLog.key }),
	]);
	return { outboxReceipts: receipts.length, notificationLog: notifications.length };
}
