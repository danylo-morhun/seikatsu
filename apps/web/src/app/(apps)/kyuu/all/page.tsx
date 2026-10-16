import { getApplicationsPage, getSources } from "@/features/kyuu/actions/applications";
import { AllView } from "@/features/kyuu/components/AllView";
import {
	APPLICATIONS_PAGE_SIZE,
	type RawKyuuSearchParams,
	hasActiveKyuuFilters,
	parseKyuuFilters,
	parseKyuuSort,
} from "@/features/kyuu/lib/search-params";
import { getUserToday } from "@/lib/timezone";

export default async function KyuuAllPage({
	searchParams,
}: {
	searchParams: Promise<RawKyuuSearchParams>;
}) {
	const raw = await searchParams;
	const filters = parseKyuuFilters(raw);
	const sort = parseKyuuSort(raw);
	const [{ rows, total }, sources, today] = await Promise.all([
		getApplicationsPage(filters, sort),
		getSources(),
		getUserToday(),
	]);

	return (
		<div className="px-4 pt-2 pb-28 sm:px-8 md:pt-4 md:pb-8">
			<AllView
				rows={rows}
				total={total}
				view={filters.view}
				filtered={hasActiveKyuuFilters(filters)}
				sources={sources.map((s) => s.source)}
				sort={sort.sort}
				dir={sort.dir}
				page={sort.page}
				pageCount={Math.ceil(total / APPLICATIONS_PAGE_SIZE)}
				today={today}
			/>
		</div>
	);
}
