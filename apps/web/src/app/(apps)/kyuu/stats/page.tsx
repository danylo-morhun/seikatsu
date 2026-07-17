import { auth } from "@/auth";
import { getWorkspace, initializeWorkspace } from "@/features/kuroji/actions/workspace";
import { getKyuuStats } from "@/features/kyuu/actions/stats";
import { StatsDashboard } from "@/features/kyuu/components/StatsDashboard";
import { redirect } from "next/navigation";

export default async function KyuuStatsPage() {
	const session = await auth();
	if (!session?.user?.id) redirect("/");

	const workspace =
		(await getWorkspace(session.user.id)) ?? (await initializeWorkspace(session.user.id));

	const stats = await getKyuuStats(workspace.id);
	if (!stats) redirect("/kyuu");

	return (
		<main className="flex flex-col pb-28 md:pb-0">
			<div className="px-4 py-6 sm:px-6">
				<StatsDashboard stats={stats} />
			</div>
		</main>
	);
}
