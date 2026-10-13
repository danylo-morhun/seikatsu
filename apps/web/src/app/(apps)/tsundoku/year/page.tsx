import { getGoal } from "@/features/tsundoku/actions/goals";
import { getYearQuotes } from "@/features/tsundoku/actions/quotes";
import { getYearStats } from "@/features/tsundoku/actions/stats";
import { GoalSection } from "@/features/tsundoku/components/GoalSection";
import {
	MonthRows,
	QuoteFeed,
	ReadingCalendar,
	Records,
	TopRated,
	YearCovers,
	YearFigures,
} from "@/features/tsundoku/components/YearSections";
import { YearSwitch } from "@/features/tsundoku/components/YearSwitch";
import { getUserToday } from "@/lib/timezone";
import type { CSSProperties } from "react";

const rise = (i: number) => ({ "--i": i }) as CSSProperties;

export default async function TsundokuYearPage({
	searchParams,
}: {
	searchParams: Promise<{ year?: string }>;
}) {
	const [{ year: rawYear }, today] = await Promise.all([searchParams, getUserToday()]);
	const thisYear = Number(today.slice(0, 4));
	const asked = Number(rawYear);
	const year = Number.isInteger(asked) && asked >= 1900 && asked <= thisYear ? asked : thisYear;
	const isCurrent = year === thisYear;

	const [stats, goal, quotes] = await Promise.all([
		getYearStats(year),
		getGoal(year),
		getYearQuotes(year),
	]);

	const startOfYear = Date.UTC(year, 0, 1);
	const daysInYear = (Date.UTC(year + 1, 0, 1) - startOfYear) / 86_400_000;
	const dayOfYear = (Date.parse(`${today}T00:00:00Z`) - startOfYear) / 86_400_000 + 1;
	const yearShare = isCurrent ? dayOfYear / daysInYear : 1;
	const lastMonth = isCurrent ? Number(today.slice(5, 7)) - 1 : 11;

	return (
		<div className="space-y-10 px-4 pt-6 pb-28 sm:px-8 md:py-8">
			<h1 className="sr-only">Tsundoku — {year} in books</h1>
			<div className="space-y-6">
				{stats.years.length > 1 && <YearSwitch years={stats.years} year={year} />}
				<YearFigures stats={stats} isCurrent={isCurrent} />
			</div>

			<div className="animate-rise" style={rise(4)}>
				<GoalSection
					year={year}
					target={goal?.targetBooks ?? null}
					booksRead={stats.finished.length}
					yearShare={yearShare}
				/>
			</div>

			<div
				className="grid animate-rise gap-10 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:gap-12"
				style={rise(5)}
			>
				<section aria-labelledby="year-covers">
					<h2 id="year-covers" className="mb-3 text-sm font-medium">
						Read in {year}
					</h2>
					<YearCovers books={stats.finished} />
				</section>
				<section aria-labelledby="year-months">
					<h2 id="year-months" className="mb-3 text-sm font-medium">
						By month
					</h2>
					<MonthRows stats={stats} lastMonth={lastMonth} />
				</section>
			</div>

			<section aria-labelledby="year-days" className="animate-rise" style={rise(6)}>
				<div className="mb-3 flex items-baseline justify-between gap-3">
					<h2 id="year-days" className="text-sm font-medium">
						Reading days
					</h2>
					<span className="font-figures text-xs text-muted-foreground">
						{stats.days.length} {stats.days.length === 1 ? "day" : "days"}
					</span>
				</div>
				<ReadingCalendar year={year} days={stats.days} today={today} />
			</section>

			<div
				className="grid animate-rise gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-12"
				style={rise(7)}
			>
				<section aria-labelledby="year-top">
					<h2 id="year-top" className="mb-3 text-sm font-medium">
						Best of the year
					</h2>
					<TopRated books={stats.finished} />
				</section>
				<section aria-labelledby="year-quotes">
					<h2 id="year-quotes" className="mb-3 text-sm font-medium">
						Quotes
					</h2>
					<QuoteFeed quotes={quotes} />
				</section>
			</div>

			{stats.finished.length > 0 && (
				<section aria-labelledby="year-records" className="animate-rise" style={rise(8)}>
					<h2 id="year-records" className="mb-3 text-sm font-medium">
						Records
					</h2>
					<Records stats={stats} />
				</section>
			)}
		</div>
	);
}
