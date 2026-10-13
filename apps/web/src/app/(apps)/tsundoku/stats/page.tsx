import { getGoal } from "@/features/tsundoku/actions/goals";
import { getYearStats } from "@/features/tsundoku/actions/stats";
import { StatsDashboard } from "@/features/tsundoku/components/StatsDashboard";
import { getUserToday } from "@/lib/timezone";

export default async function TsundokuStatsPage() {
	const year = Number((await getUserToday()).slice(0, 4));
	const [stats, goal] = await Promise.all([getYearStats(year), getGoal(year)]);

	return (
		<main className="flex flex-col pb-28 md:pb-0">
			<div className="px-4 py-6 sm:px-6">
				<StatsDashboard stats={stats} target={goal?.targetBooks ?? null} year={year} />
			</div>
		</main>
	);
}
