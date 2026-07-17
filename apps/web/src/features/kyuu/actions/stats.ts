"use server";

import { auth } from "@/auth";
import { db, eq, kyuuApplications, sql, workspaces } from "@seikatsu/db";
import { IGNORE_THRESHOLD_DAYS } from "../lib/constants";
import type { KyuuStatus } from "../lib/kyuu-schemas";
import { type KyuuFilters, buildKyuuConditions } from "./filters";

async function assertWorkspaceOwner(workspaceId: string, userId: string) {
	const [ws] = await db
		.select({ userId: workspaces.userId })
		.from(workspaces)
		.where(eq(workspaces.id, workspaceId))
		.limit(1);
	if (!ws || ws.userId !== userId) throw new Error("Forbidden");
}

export interface SourceStat {
	source: string;
	count: number;
	responded: number;
}

export interface WeekStat {
	week: string; // YYYY-MM-DD (Monday)
	count: number;
}

export interface KyuuStats {
	total: number;
	byStatus: Record<KyuuStatus, number>;
	ignored: number;
	hrScreeningCount: number;
	technicalInterviewCount: number;
	offerCount: number;
	activeInPipeline: number;
	responseRate: number; // hrScreeningCount / total
	avgResponseDays: number | null;
	sources: SourceStat[];
	weekly: WeekStat[];
}

export async function getKyuuStats(
	workspaceId: string,
	filters: KyuuFilters = {},
): Promise<KyuuStats | null> {
	const session = await auth();
	if (!session?.user?.id) return null;
	try {
		await assertWorkspaceOwner(workspaceId, session.user.id);
	} catch {
		return null;
	}

	const where = buildKyuuConditions(workspaceId, filters);

	const rows = await db
		.select({
			status: kyuuApplications.status,
			source: kyuuApplications.source,
			dateApplied: kyuuApplications.dateApplied,
			hrScreening: kyuuApplications.hrScreening,
			technicalInterview: kyuuApplications.technicalInterview,
			offer: kyuuApplications.offer,
			hrScreeningAt: kyuuApplications.hrScreeningAt,
		})
		.from(kyuuApplications)
		.where(where);

	const byStatus: Record<string, number> = {};
	let hrScreeningCount = 0;
	let technicalInterviewCount = 0;
	let offerCount = 0;
	let ignored = 0;
	let activeInPipeline = 0;
	const sourceMap = new Map<string, { count: number; responded: number }>();
	let responseDaysSum = 0;
	let responseDaysN = 0;

	const now = Date.now();
	const msPerDay = 86_400_000;

	for (const r of rows) {
		byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
		if (r.hrScreening) hrScreeningCount++;
		if (r.technicalInterview) technicalInterviewCount++;
		if (r.offer) offerCount++;

		const daysSinceApplied = Math.floor((now - new Date(r.dateApplied).getTime()) / msPerDay);
		const noContact = !r.hrScreening && !r.technicalInterview && !r.offer;
		if (r.status === "applied" && noContact && daysSinceApplied > IGNORE_THRESHOLD_DAYS) {
			ignored++;
		}
		if (r.status !== "rejected" && r.status !== "withdrawn" && !noContact) {
			activeInPipeline++;
		}

		const src = r.source ?? "Other";
		const entry = sourceMap.get(src) ?? { count: 0, responded: 0 };
		entry.count++;
		if (r.hrScreening) entry.responded++;
		sourceMap.set(src, entry);

		if (r.hrScreeningAt) {
			responseDaysSum += Math.max(
				0,
				Math.floor((r.hrScreeningAt.getTime() - new Date(r.dateApplied).getTime()) / msPerDay),
			);
			responseDaysN++;
		}
	}

	const weeklyRows = await db
		.select({
			week: sql<string>`to_char(date_trunc('week', ${kyuuApplications.dateApplied}::date), 'YYYY-MM-DD')`,
			count: sql<number>`count(*)::int`,
		})
		.from(kyuuApplications)
		.where(where)
		.groupBy(sql`date_trunc('week', ${kyuuApplications.dateApplied}::date)`)
		.orderBy(sql`date_trunc('week', ${kyuuApplications.dateApplied}::date)`);

	const sources = Array.from(sourceMap.entries())
		.map(([source, v]) => ({ source, ...v }))
		.sort((a, b) => b.count - a.count);

	return {
		total: rows.length,
		byStatus: byStatus as Record<KyuuStatus, number>,
		ignored,
		hrScreeningCount,
		technicalInterviewCount,
		offerCount,
		activeInPipeline,
		responseRate: rows.length > 0 ? hrScreeningCount / rows.length : 0,
		avgResponseDays:
			responseDaysN > 0 ? Math.round((responseDaysSum / responseDaysN) * 10) / 10 : null,
		sources,
		weekly: weeklyRows.map((w) => ({ week: w.week, count: Number(w.count) })),
	};
}
