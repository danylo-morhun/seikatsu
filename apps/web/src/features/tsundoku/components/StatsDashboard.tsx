import type { YearStats } from "@/features/tsundoku/actions/stats";
import { ChallengeCard } from "@/features/tsundoku/components/ChallengeCard";
import { PagesChart } from "@/features/tsundoku/components/PagesChart";
import { ReadingHeatmap } from "@/features/tsundoku/components/ReadingHeatmap";
import { Card, CardContent, CardHeader, CardTitle } from "@seikatsu/ui";

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
	return (
		<Card>
			<CardContent className="py-4">
				<p className="text-xs text-muted-foreground">{label}</p>
				<p className="text-2xl font-bold tabular-nums">{value}</p>
				{sub && <p className="text-xs text-muted-foreground">{sub}</p>}
			</CardContent>
		</Card>
	);
}

export function StatsDashboard({
	stats,
	target,
	year,
}: {
	stats: YearStats;
	target: number | null;
	year: number;
}) {
	return (
		<div className="space-y-6">
			<div>
				<h1 className="text-xl font-semibold">Stats</h1>
				<p className="text-sm text-muted-foreground">Your reading at a glance</p>
			</div>

			<div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
				<Kpi
					label="Total books"
					value={String(Object.values(stats.counts).reduce((s, n) => s + n, 0))}
				/>
				<Kpi
					label="Read"
					value={String(stats.counts.read)}
					sub={`${stats.counts.reading} reading`}
				/>
				<Kpi
					label={`Pages in ${year}`}
					value={stats.pages.toLocaleString()}
					sub={`${stats.pagesAllTime.toLocaleString()} all-time`}
				/>
				<Kpi
					label="Avg rating"
					value={stats.avgRating != null ? `${stats.avgRating}/10` : "—"}
					sub={`${stats.counts.want} on the pile`}
				/>
			</div>

			<div className="grid gap-4 md:grid-cols-2">
				<ChallengeCard year={year} target={target} booksRead={stats.finished.length} />
			</div>

			<Card>
				<CardHeader className="pb-2">
					<CardTitle className="text-base">Pages read by month · {year}</CardTitle>
				</CardHeader>
				<CardContent>
					<PagesChart
						data={stats.months.map((pages, i) => ({
							month: `${year}-${String(i + 1).padStart(2, "0")}`,
							pages,
						}))}
					/>
				</CardContent>
			</Card>

			<Card>
				<CardHeader className="pb-2">
					<CardTitle className="text-base">Reading activity</CardTitle>
				</CardHeader>
				<CardContent>
					<ReadingHeatmap days={stats.days} />
				</CardContent>
			</Card>

			{(stats.longest || stats.fastest) && (
				<div className="grid gap-3 sm:grid-cols-2">
					{stats.longest && (
						<Kpi
							label="Longest book"
							value={`${stats.longest.pageCount} pages`}
							sub={stats.longest.title}
						/>
					)}
					{stats.fastest?.days != null && (
						<Kpi
							label="Fastest read"
							value={`${stats.fastest.days} ${stats.fastest.days === 1 ? "day" : "days"}`}
							sub={stats.fastest.title}
						/>
					)}
				</div>
			)}
		</div>
	);
}
