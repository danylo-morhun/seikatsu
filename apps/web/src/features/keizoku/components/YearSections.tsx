import type { YearDay, YearStats } from "@/features/keizoku/actions/stats";
import { FIGURES_ROW, Figure } from "@/features/keizoku/components/Figure";
import { runUnit } from "@/features/keizoku/lib/streak";
import { BAR_FILL, barClip } from "@/lib/bar";
import { cn } from "@seikatsu/ui";
import Link from "next/link";

/** The year at a glance: check-ins lead, then full days, the rate and the best run. */
export function YearFigures({ stats }: { stats: YearStats }) {
	return (
		<section aria-label="Summary" className={`${FIGURES_ROW} md:grid-cols-[1.4fr_1fr_1fr_1fr]`}>
			<div className="col-span-2 md:col-span-1">
				<Figure
					lead
					index={0}
					label={`Check-ins · ${stats.year}`}
					value={stats.checkIns}
					note={
						stats.habits.length > 0
							? `${stats.habits.length} ${stats.habits.length === 1 ? "habit" : "habits"}`
							: undefined
					}
				/>
			</div>
			<Figure index={1} label="Full days" value={stats.fullDays} note="everything due, done" />
			<Figure index={2} label="Done of what was due" value={stats.rate} suffix="%" />
			<div className="col-span-2 md:col-span-1">
				<Figure
					index={3}
					label="Best run"
					value={stats.bestRun?.n ?? 0}
					suffix={
						stats.bestRun
							? stats.bestRun.n === 1
								? stats.bestRun.unit
								: `${stats.bestRun.unit}s`
							: "days"
					}
					note={stats.bestRun?.name}
				/>
			</div>
		</section>
	);
}

const MONTH = new Intl.DateTimeFormat("en", { month: "short", timeZone: "UTC" });

/** One row per month, newest first: how much of what was due got done, and how many check-ins. */
export function MonthRows({ stats, lastMonth }: { stats: YearStats; lastMonth: number }) {
	const months = Array.from({ length: lastMonth + 1 }, (_, m) => lastMonth - m);
	const active = (m: number) => stats.months[m].checkIns > 0;
	if (!months.some(active)) {
		return <p className="py-6 text-sm text-muted-foreground">No check-ins this year yet.</p>;
	}
	// Runs of quiet months fold into one line, as Kuroji folds empty months.
	const rows: ({ kind: "month"; m: number } | { kind: "gap"; from: number; to: number })[] = [];
	for (const m of months) {
		const prev = rows.at(-1);
		if (active(m)) rows.push({ kind: "month", m });
		else if (prev?.kind === "gap") prev.from = m;
		else rows.push({ kind: "gap", from: m, to: m });
	}
	const name = (m: number) => MONTH.format(new Date(Date.UTC(stats.year, m, 1)));

	return (
		<ol className="inset-group">
			{rows.map((row, i) => {
				if (row.kind === "gap") {
					return (
						<li key={`gap-${row.to}`} className="py-2.5 text-xs text-muted-foreground">
							{row.from === row.to ? name(row.from) : `${name(row.from)} – ${name(row.to)}`} · no
							check-ins
						</li>
					);
				}
				const { checkIns, rate } = stats.months[row.m];
				return (
					<li
						key={row.m}
						className="grid grid-cols-[3.25rem_minmax(0,1fr)_auto] items-center gap-x-3 py-2.5"
					>
						<span className="text-xs text-muted-foreground">{name(row.m)}</span>
						<span aria-hidden className="h-1.5 rounded-full bg-surface-2">
							<span
								className={cn("block h-full rounded-full bg-primary/80", BAR_FILL)}
								style={barClip((rate ?? 0) / 100, i)}
							/>
						</span>
						<span className="text-right">
							<span className="block font-figures text-sm font-medium">
								{rate == null ? "—" : `${rate}%`}
							</span>
							<span className="block font-figures text-[11px] text-muted-foreground">
								{checkIns} {checkIns === 1 ? "check-in" : "check-ins"}
							</span>
						</span>
					</li>
				);
			})}
		</ol>
	);
}

/** The year's habits, ranked by how much of what was due got done; a bar for the rate. */
export function HabitRanking({ stats }: { stats: YearStats }) {
	if (stats.habits.length === 0) {
		return <p className="py-6 text-sm text-muted-foreground">No habits this year.</p>;
	}
	return (
		<ol className="inset-group">
			{stats.habits.map((h, i) => (
				<li key={h.id} className="pb-1">
					<Link
						href={`/keizoku/${h.id}`}
						prefetch={false}
						className="group grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4 gap-y-1.5 rounded-md py-2.5 outline-none focus-visible:ring-2 focus-visible:ring-ring"
					>
						<span
							className={cn(
								"flex min-w-0 items-center gap-2 text-sm",
								h.archived && "text-muted-foreground",
							)}
						>
							<span aria-hidden className="shrink-0">
								{h.emoji}
							</span>
							<span className="truncate">{h.name}</span>
							{h.archived && <span className="shrink-0 text-xs">· archived</span>}
						</span>
						<span className="text-right">
							<span className="font-figures text-sm font-medium">
								{h.rate == null ? "—" : `${h.rate}%`}
							</span>
							<span className="ml-2 text-xs text-muted-foreground">
								<span className="font-figures">{h.done}</span>{" "}
								{h.done === 1 ? "check-in" : "check-ins"}
							</span>
						</span>
						<span aria-hidden className="col-span-2 h-1 overflow-hidden rounded-full bg-surface-2">
							<span
								className={cn(
									"block h-full rounded-full bg-primary/80 group-hover:bg-primary",
									BAR_FILL,
								)}
								style={barClip((h.rate ?? 0) / 100, i)}
							/>
						</span>
					</Link>
				</li>
			))}
		</ol>
	);
}
