import type { HeatmapDay } from "@/features/tsundoku/actions/sessions";
import type { TsundokuStats } from "@/features/tsundoku/actions/stats";
import { ChallengeCard } from "@/features/tsundoku/components/ChallengeCard";
import { GenreChart } from "@/features/tsundoku/components/GenreChart";
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
	heatmap,
	target,
	year,
	workspaceId,
}: {
	stats: TsundokuStats;
	heatmap: HeatmapDay[];
	target: number | null;
	year: number;
	workspaceId: string;
}) {
	return (
		<div className="space-y-6">
			<div>
				<h1 className="text-xl font-semibold">Stats</h1>
				<p className="text-sm text-muted-foreground">Your reading at a glance</p>
			</div>

			<div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
				<Kpi label="Total books" value={String(stats.totalBooks)} />
				<Kpi label="Read" value={String(stats.readCount)} sub={`${stats.readingCount} reading`} />
				<Kpi
					label={`Pages in ${year}`}
					value={stats.pagesThisYear.toLocaleString()}
					sub={`${stats.pagesAllTime.toLocaleString()} all-time`}
				/>
				<Kpi
					label="Avg rating"
					value={stats.avgRating != null ? `${stats.avgRating}/10` : "—"}
					sub={`${stats.wantCount} on the pile`}
				/>
			</div>

			<div className="grid gap-4 md:grid-cols-2">
				<ChallengeCard
					workspaceId={workspaceId}
					year={year}
					target={target}
					booksRead={stats.booksReadThisYear}
				/>
				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="text-base">Genres</CardTitle>
					</CardHeader>
					<CardContent>
						<GenreChart genres={stats.genres} />
					</CardContent>
				</Card>
			</div>

			<Card>
				<CardHeader className="pb-2">
					<CardTitle className="text-base">Pages read by month · {year}</CardTitle>
				</CardHeader>
				<CardContent>
					<PagesChart data={stats.pagesByMonth} />
				</CardContent>
			</Card>

			<Card>
				<CardHeader className="pb-2">
					<CardTitle className="text-base">Reading activity</CardTitle>
				</CardHeader>
				<CardContent>
					<ReadingHeatmap days={heatmap} />
				</CardContent>
			</Card>

			{(stats.longestBook || stats.fastestRead) && (
				<div className="grid gap-3 sm:grid-cols-2">
					{stats.longestBook && (
						<Kpi
							label="Longest book"
							value={`${stats.longestBook.pageCount} pages`}
							sub={stats.longestBook.title}
						/>
					)}
					{stats.fastestRead && (
						<Kpi
							label="Fastest read"
							value={`${stats.fastestRead.days} ${stats.fastestRead.days === 1 ? "day" : "days"}`}
							sub={stats.fastestRead.title}
						/>
					)}
				</div>
			)}
		</div>
	);
}
