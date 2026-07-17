import { auth } from "@/auth";
import { getWorkspace, initializeWorkspace } from "@/features/kuroji/actions/workspace";
import { getSources } from "@/features/kyuu/actions/applications";
import { getKyuuStats } from "@/features/kyuu/actions/stats";
import { StatsDashboard } from "@/features/kyuu/components/StatsDashboard";
import { parseKyuuFilters } from "@/features/kyuu/lib/search-params";
import { redirect } from "next/navigation";

export default async function KyuuStatsPage({
	searchParams,
}: {
	searchParams: Promise<{
		status?: string;
		source?: string;
		stage?: string;
		from?: string;
		to?: string;
		q?: string;
	}>;
}) {
	const session = await auth();
	if (!session?.user?.id) redirect("/");

	const workspace =
		(await getWorkspace(session.user.id)) ?? (await initializeWorkspace(session.user.id));

	const filters = parseKyuuFilters(await searchParams);

	const [stats, sources] = await Promise.all([
		getKyuuStats(workspace.id, filters),
		getSources(workspace.id),
	]);
	if (!stats) redirect("/kyuu");

	return (
		<main className="flex flex-col pb-28 md:pb-0">
			<div className="px-4 py-6 sm:px-6">
				<StatsDashboard stats={stats} sources={sources} />
			</div>
		</main>
	);
}
