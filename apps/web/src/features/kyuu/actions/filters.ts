// Shared filter-condition builder for kyuu queries.
// Not a "use server" module — called from inside server actions.

import { and, eq, gte, ilike, isNull, kyuuApplications, lte, or, sql } from "@seikatsu/db";
import { IGNORE_THRESHOLD_DAYS } from "../lib/constants";
import type { KyuuFilterStatus } from "../lib/kyuu-schemas";

export interface KyuuFilters {
	status?: KyuuFilterStatus;
	source?: string;
	stages?: Array<"hr" | "tech" | "offer">;
	from?: string;
	to?: string;
	q?: string;
}

export function buildKyuuConditions(workspaceId: string, f: KyuuFilters) {
	const conditions = [
		eq(kyuuApplications.workspaceId, workspaceId),
		isNull(kyuuApplications.archivedAt),
	];

	if (f.status === "ignored") {
		conditions.push(
			eq(kyuuApplications.status, "applied"),
			eq(kyuuApplications.hrScreening, false),
			eq(kyuuApplications.technicalInterview, false),
			eq(kyuuApplications.offer, false),
			sql`${kyuuApplications.dateApplied} < (current_date - ${IGNORE_THRESHOLD_DAYS}::int)`,
		);
	} else if (f.status) {
		conditions.push(eq(kyuuApplications.status, f.status));
	}

	if (f.source) conditions.push(eq(kyuuApplications.source, f.source));
	if (f.stages && f.stages.length > 0) {
		const stageConds = f.stages.map((s) =>
			s === "hr"
				? eq(kyuuApplications.hrScreening, true)
				: s === "tech"
					? eq(kyuuApplications.technicalInterview, true)
					: eq(kyuuApplications.offer, true),
		);
		const stageMatch = or(...stageConds);
		if (stageMatch) conditions.push(stageMatch);
	}
	if (f.from) conditions.push(gte(kyuuApplications.dateApplied, f.from));
	if (f.to) conditions.push(lte(kyuuApplications.dateApplied, f.to));
	if (f.q) {
		const like = `%${f.q}%`;
		const textMatch = or(ilike(kyuuApplications.company, like), ilike(kyuuApplications.role, like));
		if (textMatch) conditions.push(textMatch);
	}

	return and(...conditions);
}
