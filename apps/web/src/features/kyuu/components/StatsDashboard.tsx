import type { KyuuStats } from "@/features/kyuu/actions/stats";
import { Card, CardContent, CardHeader, CardTitle } from "@seikatsu/ui";
import { FunnelCard } from "./FunnelCard";
import { KyuuFilterBar } from "./KyuuFilterBar";
import { SourceChart } from "./SourceChart";
import { WeeklyTrendChart } from "./WeeklyTrendChart";

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

export function StatsDashboard({ stats, sources }: { stats: KyuuStats; sources: string[] }) {
	const rejected = stats.byStatus.rejected ?? 0;
	const withdrawn = stats.byStatus.withdrawn ?? 0;

	return (
		<div className="space-y-6">
			<div>
				<h1 className="text-xl font-semibold">Stats</h1>
				<p className="text-sm text-muted-foreground">Your job search at a glance</p>
			</div>

			<KyuuFilterBar sources={sources} />

			<div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
				<Kpi label="Applied" value={String(stats.total)} />
				<Kpi label="Ignored" value={String(stats.ignored)} sub="no response after 14d+" />
				<Kpi label="Rejected" value={String(rejected)} sub={`${withdrawn} withdrawn`} />
				<Kpi
					label="Response rate"
					value={`${(stats.responseRate * 100).toFixed(1)}%`}
					sub={`${stats.hrScreeningCount} HR screenings`}
				/>
			</div>

			<div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
				<Kpi label="HR screenings" value={String(stats.hrScreeningCount)} />
				<Kpi label="Technical interviews" value={String(stats.technicalInterviewCount)} />
				<Kpi label="Offers" value={String(stats.offerCount)} />
			</div>

			<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="text-base">Funnel</CardTitle>
					</CardHeader>
					<CardContent>
						<FunnelCard stats={stats} />
					</CardContent>
				</Card>
				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="text-base">Sources</CardTitle>
					</CardHeader>
					<CardContent>
						<SourceChart data={stats.sources} />
					</CardContent>
				</Card>
			</div>

			<Card>
				<CardHeader className="pb-2">
					<CardTitle className="text-base">Applications per week</CardTitle>
				</CardHeader>
				<CardContent>
					<WeeklyTrendChart data={stats.weekly} />
				</CardContent>
			</Card>

			{(stats.activeInPipeline > 0 || stats.avgResponseDays != null) && (
				<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
					{stats.activeInPipeline > 0 && (
						<Kpi
							label="Currently active"
							value={String(stats.activeInPipeline)}
							sub="beyond initial apply, not rejected/withdrawn"
						/>
					)}
					{stats.avgResponseDays != null && (
						<Kpi
							label="Avg. time to first response"
							value={`${stats.avgResponseDays} days`}
							sub="applied → HR screening"
						/>
					)}
				</div>
			)}
		</div>
	);
}
