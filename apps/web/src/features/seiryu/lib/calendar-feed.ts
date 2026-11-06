// Reads for the calendar feed. Not a "use server" module: the feed route has no session and
// finds its workspace by the link's secret.

import {
	and,
	asc,
	db,
	eq,
	isNotNull,
	isNull,
	notificationPrefs,
	seiryuCalendarFeeds,
	seiryuCards,
	seiryuColumns,
	seiryuProjects,
} from "@seikatsu/db";
import { hashSecret } from "@/features/mcp/lib/oauth";
import { safeTimeZone } from "@/features/pwa/lib/schedule";
import type { FeedCard } from "@/features/seiryu/lib/ics";
import { shortTime } from "@/features/seiryu/lib/reminder";

export const feedUrl = (origin: string, token: string) =>
	`${origin}/api/seiryu/calendar/${token}.ics`;

/** When the workspace's link was made, or null when it has none. */
export async function getCalendarFeed(workspaceId: string) {
	const [feed] = await db
		.select({ createdAt: seiryuCalendarFeeds.createdAt })
		.from(seiryuCalendarFeeds)
		.where(eq(seiryuCalendarFeeds.workspaceId, workspaceId));
	return feed ?? null;
}

/** The feed's workspace zone and open cards with a due date, or null for an unknown link. */
export async function readFeed(token: string) {
	const [feed] = await db
		.select({ workspaceId: seiryuCalendarFeeds.workspaceId, timeZone: notificationPrefs.timeZone })
		.from(seiryuCalendarFeeds)
		.leftJoin(notificationPrefs, eq(notificationPrefs.workspaceId, seiryuCalendarFeeds.workspaceId))
		.where(eq(seiryuCalendarFeeds.tokenHash, hashSecret(token)));
	if (!feed) return null;

	const rows = await db
		.select({
			id: seiryuCards.id,
			title: seiryuCards.title,
			projectId: seiryuProjects.id,
			projectName: seiryuProjects.name,
			dueDate: seiryuCards.dueDate,
			dueTime: seiryuCards.dueTime,
		})
		.from(seiryuCards)
		.innerJoin(seiryuProjects, eq(seiryuProjects.id, seiryuCards.projectId))
		.innerJoin(seiryuColumns, eq(seiryuColumns.id, seiryuCards.columnId))
		.where(
			and(
				eq(seiryuProjects.workspaceId, feed.workspaceId),
				isNull(seiryuProjects.archivedAt),
				isNull(seiryuCards.archivedAt),
				eq(seiryuColumns.isDone, false),
				isNotNull(seiryuCards.dueDate),
			),
		)
		.orderBy(asc(seiryuCards.dueDate));
	const cards: FeedCard[] = rows.map((r) => ({
		...r,
		dueDate: r.dueDate ?? "",
		dueTime: shortTime(r.dueTime),
	}));
	return { timeZone: safeTimeZone(feed.timeZone), cards };
}
