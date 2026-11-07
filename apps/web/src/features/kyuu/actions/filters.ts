// Shared filter-condition builder for kyuu queries.
// Not a "use server" module — called from inside server actions.

import {
	and,
	eq,
	gte,
	ilike,
	inArray,
	isNotNull,
	isNull,
	kyuuApplications,
	lte,
	or,
} from "@seikatsu/db";
import { type KyuuFilters, VIEW_STATUSES } from "../lib/search-params";

export function buildKyuuConditions(workspaceId: string, f: Partial<KyuuFilters>) {
	const conditions = [
		eq(kyuuApplications.workspaceId, workspaceId),
		f.view === "archived"
			? isNotNull(kyuuApplications.archivedAt)
			: isNull(kyuuApplications.archivedAt),
	];

	const statuses = f.view ? VIEW_STATUSES[f.view] : undefined;
	if (statuses) conditions.push(inArray(kyuuApplications.status, [...statuses]));
	if (f.source) conditions.push(eq(kyuuApplications.source, f.source));
	if (f.status) conditions.push(eq(kyuuApplications.status, f.status));
	if (f.method) conditions.push(eq(kyuuApplications.applyMethod, f.method));
	if (f.from) conditions.push(gte(kyuuApplications.dateApplied, f.from));
	if (f.to) conditions.push(lte(kyuuApplications.dateApplied, f.to));
	if (f.q) {
		// The user's text is a literal: % and _ match themselves.
		const like = `%${f.q.replace(/[\\%_]/g, "\\$&")}%`;
		const textMatch = or(ilike(kyuuApplications.company, like), ilike(kyuuApplications.role, like));
		if (textMatch) conditions.push(textMatch);
	}

	return and(...conditions);
}
