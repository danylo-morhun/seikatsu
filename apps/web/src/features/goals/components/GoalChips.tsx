import { and, asc, db, eq, goalLinks, goals, inArray, isNull } from "@seikatsu/db";
import Link from "next/link";
import type { LinkKind } from "@/features/goals/lib/progress";
import { getCurrentWorkspace } from "@/lib/session";

/** The open goals that gather any of these containers (all of the kind, for "jobs"). */
async function goalsFor(workspaceId: string, kind: LinkKind, refIds: string[] | null) {
	if (refIds && refIds.length === 0) return [];
	return db
		.selectDistinct({ id: goals.id, name: goals.name, position: goals.position })
		.from(goalLinks)
		.innerJoin(goals, eq(goals.id, goalLinks.goalId))
		.where(
			and(
				eq(goals.workspaceId, workspaceId),
				isNull(goals.archivedAt),
				eq(goalLinks.kind, kind),
				refIds ? inArray(goalLinks.refId, refIds) : undefined,
			),
		)
		.orderBy(asc(goals.position));
}

/**
 * "志 For Tatry in February": a container's goals, shown in its own app so the why sits beside
 * the work. Nothing when it serves no goal. Server component; links open Goals.
 */
export async function GoalChips({
	kind,
	refIds = null,
	className,
}: {
	kind: LinkKind;
	/** The containers on the page; null for "jobs" (the search as a whole). */
	refIds?: string[] | null;
	className?: string;
}) {
	const ws = await getCurrentWorkspace();
	if (!ws) return null;
	const list = await goalsFor(ws.id, kind, refIds).catch(() => []);
	if (list.length === 0) return null;
	return (
		<p className={className ?? "flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground"}>
			<span aria-hidden className="font-semibold">
				志
			</span>
			<span>For</span>
			{list.map((g, i) => (
				<span key={g.id}>
					<Link
						href="/goals"
						prefetch
						className="font-medium text-foreground underline-offset-4 hover:underline"
					>
						{g.name}
					</Link>
					{i < list.length - 1 ? "," : ""}
				</span>
			))}
		</p>
	);
}
