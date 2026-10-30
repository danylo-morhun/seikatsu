import { PageTitle } from "@/components/PageTitle";
import { YearSwitch } from "@/components/YearSwitch";
import { getHoshii, getSummaryItems } from "@/features/hoshii/actions/data";
import {
	SummaryFigures,
	SummaryMonths,
	SummaryWants,
} from "@/features/hoshii/components/SummarySections";
import { summaryYears, yearSummary } from "@/features/hoshii/lib/summary";
import { getCurrentWorkspace } from "@/lib/session";
import { getUserToday } from "@/lib/timezone";
import { redirect } from "next/navigation";
import type { CSSProperties } from "react";

const rise = (i: number) => ({ "--i": i }) as CSSProperties;

export default async function HoshiiSummaryPage({
	searchParams,
}: {
	searchParams: Promise<{ year?: string }>;
}) {
	const workspace = await getCurrentWorkspace();
	if (!workspace) redirect("/");
	const [{ year: rawYear }, today] = await Promise.all([searchParams, getUserToday()]);
	const [data, summaryItems] = await Promise.all([
		getHoshii(workspace, today),
		getSummaryItems(workspace, today),
	]);

	const thisYear = Number(today.slice(0, 4));
	const years = summaryYears(summaryItems, thisYear);
	const asked = Number(rawYear);
	const year = years.includes(asked) ? asked : thisYear;
	const summary = yearSummary(summaryItems, year);
	const lastMonth = year === thisYear ? Number(today.slice(5, 7)) - 1 : 11;
	const ended = data.items
		.filter(
			(i) =>
				(i.state === "bought" && i.boughtOn?.startsWith(`${year}-`)) ||
				(i.state === "released" && i.releasedOn?.startsWith(`${year}-`)),
		)
		.sort((a, b) =>
			(b.boughtOn ?? b.releasedOn ?? "").localeCompare(a.boughtOn ?? a.releasedOn ?? ""),
		);

	return (
		<div className="space-y-10 px-4 pt-6 pb-28 sm:px-8 md:py-8">
			<PageTitle title={`${year} in wants`} />
			<div className="space-y-6">
				{years.length > 1 && <YearSwitch years={years} year={year} base="/hoshii/summary" />}
				<SummaryFigures summary={summary} currency={data.currency} />
			</div>
			<div
				className="grid animate-rise gap-10 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:gap-12"
				style={rise(4)}
			>
				<section aria-labelledby="summary-months">
					<h2 id="summary-months" className="mb-3 text-sm font-medium">
						By month
					</h2>
					<SummaryMonths
						summary={summary}
						year={year}
						lastMonth={lastMonth}
						currency={data.currency}
					/>
				</section>
				<section aria-labelledby="summary-wants">
					<h2 id="summary-wants" className="mb-3 text-sm font-medium">
						Bought and let go
					</h2>
					<SummaryWants items={ended} today={today} currency={data.currency} />
				</section>
			</div>
		</div>
	);
}
