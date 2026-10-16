import { getSources, getStats } from "@/features/kyuu/actions/applications";
import { StatsView } from "@/features/kyuu/components/StatsView";
import { type RawKyuuSearchParams, parseKyuuFilters } from "@/features/kyuu/lib/search-params";

export default async function KyuuStatsPage({
	searchParams,
}: {
	searchParams: Promise<RawKyuuSearchParams>;
}) {
	const filters = parseKyuuFilters(await searchParams);
	const [stats, sources] = await Promise.all([getStats(filters), getSources()]);

	return (
		<div className="px-4 pt-6 pb-28 sm:px-8 md:py-8">
			<StatsView stats={stats} sources={sources.map((s) => s.source)} />
		</div>
	);
}
