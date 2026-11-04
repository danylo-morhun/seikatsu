import { redirect } from "next/navigation";
import { Suspense } from "react";
import { GoalChips } from "@/features/goals/components/GoalChips";
import { getBoard } from "@/features/seiryu/actions/cards";
import { getProjects } from "@/features/seiryu/actions/projects";
import { KanbanBoard } from "@/features/seiryu/components/KanbanBoard";
import { toArchivedRows } from "@/features/seiryu/lib/archive";
import { getUserTimeZone, getUserToday } from "@/lib/timezone";

export default async function SeiryuProjectPage({
	params,
}: {
	params: Promise<{ projectId: string }>;
}) {
	const { projectId } = await params;
	const [projects, board, today, timeZone] = await Promise.all([
		getProjects(),
		getBoard(projectId),
		getUserToday(),
		getUserTimeZone(),
	]);
	const project = projects.find((p) => p.id === projectId);

	// Stale links (a deleted project) land on the Seiryu index instead of a 404.
	if (!project || !board) redirect("/seiryu");

	return (
		<>
			<Suspense>
				<GoalChips
					kind="project"
					refIds={[project.id]}
					className="flex flex-wrap items-center gap-1.5 px-4 pt-3 text-xs text-muted-foreground sm:px-8"
				/>
			</Suspense>
			<Suspense>
				<KanbanBoard
					project={{ id: project.id, name: project.name }}
					today={today}
					columns={board.columns}
					cards={board.cards}
					projectLabels={board.labels}
					archived={toArchivedRows(board.archived, timeZone)}
					archivedTotal={board.archivedTotal}
				/>
			</Suspense>
		</>
	);
}
