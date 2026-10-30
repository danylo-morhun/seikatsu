import { PageTitle } from "@/components/PageTitle";
import { YearSwitch } from "@/components/YearSwitch";
import { getYearStats } from "@/features/keizoku/actions/stats";
import { Heatmap } from "@/features/keizoku/components/Heatmap";
import { HabitRanking, MonthRows, YearFigures } from "@/features/keizoku/components/YearSections";
import { activityText } from "@/features/keizoku/lib/constants";
import { getUserToday } from "@/lib/timezone";
import type { CSSProperties } from "react";

const rise = (i: number) => ({ "--i": i }) as CSSProperties;

export default async function KeizokuYearPage({
	searchParams,
}: {
	searchParams: Promise<{ year?: string }>;
}) {
	const [{ year: rawYear }, today] = await Promise.all([searchParams, getUserToday()]);
	const thisYear = Number(today.slice(0, 4));
	const asked = Number(rawYear);
	const year = Number.isInteger(asked) && asked >= 2000 && asked <= thisYear ? asked : thisYear;
	const stats = await getYearStats(year, today);
	const lastMonth = year === thisYear ? Number(today.slice(5, 7)) - 1 : 11;
	const activeDays = stats.days.filter((d) => d.done > 0).length;

	return (
		<div className="space-y-10 px-4 pt-6 pb-28 sm:px-8 md:py-8">
			<PageTitle title={`${year} in habits`} />
			<div className="space-y-6">
				{stats.years.length > 1 && (
					<YearSwitch years={stats.years} year={year} base="/keizoku/year" />
				)}
				<YearFigures stats={stats} />
			</div>

			<section aria-labelledby="year-days" className="animate-rise" style={rise(4)}>
				<div className="mb-3 flex items-baseline justify-between gap-3">
					<h2 id="year-days" className="text-sm font-medium">
						Every day
					</h2>
					<span className="font-figures text-xs text-muted-foreground">
						{activeDays} {activeDays === 1 ? "day" : "days"} with check-ins
					</span>
				</div>
				<Heatmap
					from={`${year}-01-01`}
					to={`${year}-12-31`}
					anchor={year === thisYear ? today : `${year}-12-31`}
					today={today}
					days={stats.days.map((d) => ({ date: d.date, level: d.level, text: activityText(d) }))}
					label={`${year}, every habit`}
					summary={`${stats.checkIns} check-ins in ${year}`}
				/>
			</section>

			<div
				className="grid animate-rise gap-10 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:gap-12"
				style={rise(5)}
			>
				<section aria-labelledby="year-habits">
					<h2 id="year-habits" className="mb-3 text-sm font-medium">
						Habits
					</h2>
					<HabitRanking stats={stats} />
				</section>
				<section aria-labelledby="year-months">
					<h2 id="year-months" className="mb-3 text-sm font-medium">
						By month
					</h2>
					<MonthRows stats={stats} lastMonth={lastMonth} />
				</section>
			</div>
		</div>
	);
}
