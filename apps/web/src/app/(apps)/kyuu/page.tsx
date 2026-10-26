import {
	getApplicationsPage,
	getGhostDue,
	getSources,
	getViewCounts,
} from "@/features/kyuu/actions/applications";
import { getMailInbox } from "@/features/kyuu/actions/mail";
import { AllView } from "@/features/kyuu/components/AllView";
import { MailInbox } from "@/features/kyuu/components/MailInbox";
import {
	APPLICATIONS_PAGE_SIZE,
	type RawKyuuSearchParams,
	hasActiveKyuuFilters,
	parseKyuuFilters,
	parseKyuuSort,
} from "@/features/kyuu/lib/search-params";
import { getUserToday } from "@/lib/timezone";

export default async function KyuuPage({
	searchParams,
}: {
	searchParams: Promise<RawKyuuSearchParams>;
}) {
	const raw = await searchParams;
	const filters = parseKyuuFilters(raw);
	const sort = parseKyuuSort(raw);
	const [{ rows, total }, counts, ghostDue, sources, today, mail] = await Promise.all([
		getApplicationsPage(filters, sort),
		getViewCounts(),
		filters.view === "waiting" ? getGhostDue() : Promise.resolve([]),
		getSources(),
		getUserToday(),
		getMailInbox(),
	]);

	return (
		<div className="px-4 pt-2 pb-28 sm:px-8 md:pt-4 md:pb-8">
			<MailInbox items={mail.items} choices={mail.choices} today={today} />
			<AllView
				rows={rows}
				counts={counts}
				ghostDue={ghostDue}
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
