// Server-only: deletes bookkeeping rows nobody reads after a while. Run by the daily cron.

import {
	and,
	db,
	isNotNull,
	lt,
	mcpCalls,
	mcpClients,
	mcpCodes,
	mcpGrants,
	mcpTokens,
	notInArray,
	notificationLog,
	notLike,
	or,
	outboxReceipts,
} from "@seikatsu/db";

const DAY = 24 * 60 * 60 * 1000;

/**
 * Outbox receipts only stop a retried replay from running twice; retries come within days.
 * Send-once keys are mostly per day or month. Aisha's aren't: an overdue item or an expired
 * document keeps the same key while it stays that way, so dropping it would send the reminder
 * again. Those stay (a few rows per item).
 *
 * MCP: Settings shows the last 50 writes of live grants and the rate limit looks back a minute,
 * so calls go after 90 days. A revoked grant goes (with its tokens and calls) after 30. An OAuth
 * grant whose tokens have all expired can never be used again, so it goes too (a day's grace so
 * a grant just being issued isn't caught between its insert and its tokens'). A registered
 * client nobody granted anything goes after 30 days; a client that comes back re-registers.
 */
export const RETENTION_DAYS = {
	outboxReceipts: 30,
	notificationLog: 90,
	mcpCalls: 90,
	mcpRevokedGrants: 30,
	mcpIdleClients: 30,
} as const;

export async function pruneOldRows(now = new Date()) {
	const before = (days: number) => new Date(now.getTime() - days * DAY);
	const [receipts, notifications, codes, tokens, calls] = await Promise.all([
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
		// Expired codes and tokens are refused anyway. A spent refresh token stays until it
		// expires: it's what catches a leaked one being replayed.
		db.delete(mcpCodes).where(lt(mcpCodes.expiresAt, now)).returning({ hash: mcpCodes.codeHash }),
		db
			.delete(mcpTokens)
			.where(lt(mcpTokens.expiresAt, now))
			.returning({ hash: mcpTokens.tokenHash }),
		db
			.delete(mcpCalls)
			.where(lt(mcpCalls.createdAt, before(RETENTION_DAYS.mcpCalls)))
			.returning({ id: mcpCalls.id }),
	]);

	// After the tokens: a grant left without any is dead.
	const grants = await db
		.delete(mcpGrants)
		.where(
			or(
				lt(mcpGrants.revokedAt, before(RETENTION_DAYS.mcpRevokedGrants)),
				and(
					isNotNull(mcpGrants.clientId),
					lt(mcpGrants.createdAt, before(1)),
					notInArray(mcpGrants.id, db.select({ id: mcpTokens.grantId }).from(mcpTokens)),
				),
			),
		)
		.returning({ id: mcpGrants.id });

	// After the grants: a client with no grant and no pending code is idle.
	const clients = await db
		.delete(mcpClients)
		.where(
			and(
				lt(mcpClients.createdAt, before(RETENTION_DAYS.mcpIdleClients)),
				notInArray(
					mcpClients.id,
					db
						.select({ id: mcpGrants.clientId })
						.from(mcpGrants)
						.where(isNotNull(mcpGrants.clientId)),
				),
				notInArray(mcpClients.id, db.select({ id: mcpCodes.clientId }).from(mcpCodes)),
			),
		)
		.returning({ id: mcpClients.id });

	return {
		outboxReceipts: receipts.length,
		notificationLog: notifications.length,
		mcp: {
			codes: codes.length,
			tokens: tokens.length,
			calls: calls.length,
			grants: grants.length,
			clients: clients.length,
		},
	};
}
