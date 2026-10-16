import { FIGURES_ROW, Figure } from "@/features/keizoku/components/Figure";
import { BAR_FILL, barClip } from "@/lib/bar";
import { cn } from "@seikatsu/ui";
import type { CSSProperties } from "react";
import type { KyuuStats, Rate } from "../lib/stats";
import { KyuuFilters } from "./KyuuFilters";

const rise = (i: number) => ({ "--i": i }) as CSSProperties;
const pct = (rate: number | null) => (rate == null ? null : Math.round(rate * 100));
const MONTH = new Intl.DateTimeFormat("en", { month: "short", timeZone: "UTC" });

/** Stats: how the search is going, from what actually happened. */
export function StatsView({ stats, sources }: { stats: KyuuStats; sources: string[] }) {
	const ghosted = stats.closed.ghosted;
	return (
		<>
			<h1 className="sr-only">Kyuu — stats</h1>
			<KyuuFilters sources={sources} />

			<section
				aria-label="Summary"
				className={`${FIGURES_ROW} mt-8 md:grid-cols-[1.4fr_1fr_1fr_1fr]`}
			>
				<div className="col-span-2 md:col-span-1">
					<Figure
						lead
						index={0}
						label="Answered"
						value={pct(stats.replyRate)}
						suffix="%"
						note={`${stats.answered} of ${stats.sent} sent, rejections included`}
					/>
				</div>
				<Figure
					index={1}
					label="Reached an interview"
					value={pct(stats.interviewRate)}
					suffix="%"
					note={`${stats.interviewed} ${stats.interviewed === 1 ? "application" : "applications"}`}
				/>
				<Figure
					index={2}
					label="First answer"
					value={stats.firstAnswer?.median ?? null}
					suffix="days"
					note={
						stats.firstAnswer
							? `median of ${stats.firstAnswer.n} with a known day`
							: "No answers dated yet"
					}
				/>
				<Figure
					index={3}
					label="Offers"
					value={stats.offers}
					note={`${stats.inProgress} in progress · ${stats.waiting} waiting`}
				/>
			</section>

			<div className="mt-12 grid gap-x-12 gap-y-12 lg:grid-cols-2">
				<Block title="How far they got" index={4}>
					<Bars
						rows={stats.funnel.map((f) => ({
							label: f.label,
							value: f.count,
							ratio: stats.sent > 0 ? f.count / stats.sent : 0,
							note: stats.sent > 0 ? `${Math.round((f.count / stats.sent) * 100)}%` : "—",
						}))}
					/>
				</Block>

				<Block
					title="Where they stopped"
					index={5}
					note={`${stats.closed.rejected} rejected · ${ghosted} ghosted · ${stats.closed.withdrawn} withdrawn`}
				>
					<Bars
						rows={stats.stops.map((s) => {
							const closed = stats.closed.rejected + ghosted + stats.closed.withdrawn;
							return {
								label: s.label,
								value: s.count,
								ratio: closed > 0 ? s.count / closed : 0,
							};
						})}
					/>
				</Block>

				<Block title="Sources" index={6} note="Answered, of sent">
					<RateList rows={stats.sources.slice(0, 10).map((s) => ({ label: s.source, ...s }))} />
				</Block>

				<Block title="Sent by" index={7} note="Answered, of sent">
					<RateList
						rows={[
							{ label: "The pipeline", ...stats.methods.auto },
							{ label: "Hand", ...stats.methods.manual },
						].filter((r) => r.sent > 0)}
					/>
				</Block>
			</div>

			<Block title="Sent per week" index={8} className="mt-12">
				<Weekly weeks={stats.weekly} />
			</Block>
		</>
	);
}

function Block({
	title,
	note,
	index,
	className,
	children,
}: {
	title: string;
	note?: string;
	index: number;
	className?: string;
	children: React.ReactNode;
}) {
	return (
		<section className={cn("min-w-0 animate-rise", className)} style={rise(index)}>
			<div className="mb-4 flex items-baseline justify-between gap-3">
				<h2 className="text-sm font-medium">{title}</h2>
				{note && <p className="truncate text-xs text-muted-foreground">{note}</p>}
			</div>
			{children}
		</section>
	);
}

function Bars({
	rows,
}: {
	rows: { label: string; value: number; ratio: number; note?: string }[];
}) {
	return (
		<ol className="space-y-3">
			{rows.map((r, i) => (
				<li key={r.label} className="grid grid-cols-[9rem_minmax(0,1fr)_3.5rem] items-center gap-3">
					<span className="truncate text-xs text-muted-foreground">{r.label}</span>
					<span aria-hidden className="h-1.5 rounded-full bg-surface-2">
						<span
							className={cn("block h-full rounded-full bg-primary/80", BAR_FILL)}
							style={barClip(r.ratio, i)}
						/>
					</span>
					<span className="text-right">
						<span className="font-figures text-sm font-medium">{r.value}</span>
						{r.note && (
							<span className="ml-1.5 font-figures text-[11px] text-muted-foreground">
								{r.note}
							</span>
						)}
					</span>
				</li>
			))}
		</ol>
	);
}

function RateList({ rows }: { rows: (Rate & { label: string })[] }) {
	if (rows.length === 0) return <p className="text-sm text-muted-foreground">Nothing sent yet.</p>;
	return (
		<ol className="space-y-3">
			{rows.map((r, i) => (
				<li key={r.label} className="grid grid-cols-[9rem_minmax(0,1fr)_5.5rem] items-center gap-3">
					<span className="truncate text-xs text-muted-foreground">{r.label}</span>
					<span aria-hidden className="h-1.5 rounded-full bg-surface-2">
						<span
							className={cn("block h-full rounded-full bg-primary/80", BAR_FILL)}
							style={barClip(r.rate ?? 0, i)}
						/>
					</span>
					<span className="text-right">
						<span className="font-figures text-sm font-medium">{pct(r.rate) ?? "—"}%</span>
						<span className="ml-1.5 font-figures text-[11px] text-muted-foreground">
							{r.answered}/{r.sent}
						</span>
					</span>
				</li>
			))}
		</ol>
	);
}

function Weekly({ weeks }: { weeks: KyuuStats["weekly"] }) {
	if (weeks.length === 0) return <p className="text-sm text-muted-foreground">Nothing sent yet.</p>;
	const max = Math.max(...weeks.map((w) => w.count), 1);
	// Long searches: the last year of weeks, so each bar keeps some width.
	const shown = weeks.slice(-53);
	return (
		<figure>
			<div
				role="img"
				aria-label={`Applications sent per week, ${shown.length} weeks, most in a week ${max}`}
				className="flex h-32 items-end gap-px"
			>
				{shown.map((w) => (
					<span
						key={w.week}
						title={`Week of ${w.week}: ${w.count}`}
						className={cn(
							"min-w-0 flex-1 rounded-t-[2px]",
							w.count > 0 ? "bg-primary/70 hover:bg-primary" : "bg-surface-2",
						)}
						style={{ height: w.count > 0 ? `${Math.max(4, (w.count / max) * 100)}%` : "2px" }}
					/>
				))}
			</div>
			<div aria-hidden className="mt-1.5 flex gap-px text-[11px] text-muted-foreground">
				{shown.map((w, i) => {
					const month = w.week.slice(5, 7);
					const first = i === 0 || shown[i - 1].week.slice(5, 7) !== month;
					return (
						<span key={w.week} className="min-w-0 flex-1 overflow-visible whitespace-nowrap">
							{first
								? month === "01" || i === 0
									? `${MONTH.format(new Date(`${w.week}T00:00:00Z`))} ’${w.week.slice(2, 4)}`
									: MONTH.format(new Date(`${w.week}T00:00:00Z`))
								: ""}
						</span>
					);
				})}
			</div>
		</figure>
	);
}
