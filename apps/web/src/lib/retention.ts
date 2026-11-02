// Server-only: deletes bookkeeping rows nobody reads after a while. Run by the daily cron.

import { db, lt, notificationLog, outboxReceipts } from "@seikatsu/db";

const DAY = 24 * 60 * 60 * 1000;

/**
 * Outbox receipts only stop a retried replay from running twice; retries come within days.
 * Send-once keys are mostly per day or month. The rest (an overdue car item, an expired
 * document) get one more reminder after 90 quiet days, which is fine.
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
			.where(lt(notificationLog.sentAt, before(RETENTION_DAYS.notificationLog)))
			.returning({ key: notificationLog.key }),
	]);
	return { outboxReceipts: receipts.length, notificationLog: notifications.length };
}
