import { auth } from "@/auth";
import { getWorkspace, initializeWorkspace } from "@/features/kuroji/actions/workspace";
import { getGoal } from "@/features/tsundoku/actions/goals";
import { getReadingHeatmap } from "@/features/tsundoku/actions/sessions";
import { getStats } from "@/features/tsundoku/actions/stats";
import { StatsDashboard } from "@/features/tsundoku/components/StatsDashboard";
import { redirect } from "next/navigation";

export default async function TsundokuStatsPage() {
	const session = await auth();
	if (!session?.user?.id) redirect("/");

	const workspace =
		(await getWorkspace(session.user.id)) ?? (await initializeWorkspace(session.user.id));
	const year = new Date().getFullYear();

	const [stats, heatmap, goal] = await Promise.all([
		getStats(workspace.id, year),
		getReadingHeatmap(workspace.id),
		getGoal(workspace.id, year),
	]);

	if (!stats) redirect("/tsundoku");

	return (
		<main className="flex flex-col pb-28 md:pb-0">
			<div className="px-4 py-6 sm:px-6">
				<StatsDashboard
					stats={stats}
					heatmap={heatmap}
					target={goal?.targetBooks ?? null}
					year={year}
					workspaceId={workspace.id}
				/>
			</div>
		</main>
	);
}
