import { getArchivedHabits } from "@/features/keizoku/actions/habits";
import { getTodayHabits } from "@/features/keizoku/actions/logs";
import { getActivityHeatmap } from "@/features/keizoku/actions/stats";
import { KeizokuActivityHeatmap } from "@/features/keizoku/components/KeizokuActivityHeatmap";
import { TodayList } from "@/features/keizoku/components/TodayList";
import { getCurrentWorkspace } from "@/lib/session";
import { getUserToday } from "@/lib/timezone";
import { redirect } from "next/navigation";

export default async function KeizokuPage() {
	const [workspace, date] = await Promise.all([getCurrentWorkspace(), getUserToday()]);
	if (!workspace) redirect("/");

	const [todayHabits, archivedHabits, heatmap] = await Promise.all([
		getTodayHabits(workspace.id, date),
		getArchivedHabits(workspace.id),
		getActivityHeatmap(workspace.id, undefined, date),
	]);

	return (
		<TodayList
			workspaceId={workspace.id}
			date={date}
			todayHabits={todayHabits}
			archivedHabits={archivedHabits}
			heatmap={<KeizokuActivityHeatmap days={heatmap} today={date} />}
		/>
	);
}
