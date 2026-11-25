import { cn } from "@seikatsu/ui";
import Link from "next/link";
import type { CSSProperties } from "react";
import { NowLine } from "@/features/calendar/components/NowLine";
import { Chip } from "@/features/calendar/components/parts";
import { hoursOf, hrefOf, placeTimed } from "@/features/calendar/lib/calendar";
import type { WeekDay, WeekEntry } from "@/features/week/lib/week";
import { APPS_CONFIG } from "@/lib/app-themes";

/** Rows a week's day lists above the hours before "+n more" (the day view lists them all). */
const STRIP = 4;
/** One hour's height, in px. */
const HOUR = 48;

const WEEKDAY = new Intl.DateTimeFormat("en-GB", { weekday: "short", timeZone: "UTC" });
const utc = (iso: string) => new Date(`${iso}T00:00:00Z`);

const timed = (d: WeekDay) =>
	d.plan.filter((e): e is WeekEntry & { time: string } => Boolean(e.time));

/**
 * Days side by side over the hours, as a calendar does: rows with a time sit at it, the rest
 * (and, for days behind, what happened) in the strip above. One column is the day view.
 */
export function TimeGrid({ days, today }: { days: WeekDay[]; today: string }) {
	const { from, to } = hoursOf(days.flatMap((d) => timed(d).map((e) => e.time)));
	const hours = Array.from({ length: to - from }, (_, i) => from + i);
	const cols = days.length;
	const grid = cn(
		"grid",
		cols === 7 ? "grid-cols-[3rem_repeat(7,minmax(0,1fr))]" : "grid-cols-[3rem_minmax(0,1fr)]",
	);

	return (
		<div className="group-card overflow-hidden p-0!">
			{/* The days' heads and their all-day strip. */}
			<div className={cn(grid, "border-b border-rule")}>
				<div className="border-r border-rule" />
				{days.map((d) => {
					const untimed = d.plan.filter((e) => !e.time);
					return (
						<div key={d.date} className="min-w-0 border-r border-rule p-1.5 last:border-r-0">
							{cols > 1 && (
								<Link
									href={hrefOf("day", d.date, today)}
									prefetch={false}
									className="mb-1 flex items-baseline gap-1.5 rounded-md px-1 text-xs text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
								>
									{WEEKDAY.format(utc(d.date))}
									<span
										className={cn(
											"flex size-6 items-center justify-center rounded-full text-sm tabular-nums",
											d.isToday
												? "bg-primary font-semibold text-primary-foreground"
												: "text-foreground",
										)}
									>
										{utc(d.date).getUTCDate()}
									</span>
								</Link>
							)}
							<div className="space-y-0.5">
								{[
									...untimed.map((e) => ({ e, done: false })),
									...d.done.map((e) => ({ e, done: true })),
								]
									.slice(0, cols > 1 ? STRIP : undefined)
									.map(({ e, done }) => (
										<Chip key={e.key} entry={e} done={done} />
									))}
								{cols > 1 && untimed.length + d.done.length > STRIP && (
									<Link
										href={hrefOf("day", d.date, today)}
										prefetch={false}
										className="block px-1 text-[11px] text-muted-foreground hover:text-foreground"
									>
										+{untimed.length + d.done.length - STRIP} more
									</Link>
								)}
							</div>
						</div>
					);
				})}
			</div>

			{/* The hours. */}
			<div className={grid}>
				<div className="relative border-r border-rule">
					{hours.map((h) => (
						<div
							key={h}
							className="h-12 pr-1.5 text-right text-[10px] tabular-nums text-muted-foreground"
						>
							<span className="relative -top-1.5">
								{h === from ? "" : `${String(h).padStart(2, "0")}:00`}
							</span>
						</div>
					))}
				</div>
				{days.map((d) => (
					<div
						key={d.date}
						className={cn(
							"relative border-r border-rule last:border-r-0",
							d.past && "bg-muted-foreground/[0.03]",
						)}
					>
						{hours.map((h) => (
							<div key={h} className="h-12 border-b border-rule/60 last:border-b-0" />
						))}
						{placeTimed(timed(d)).map((p) => (
							<Link
								key={p.entry.key}
								href={p.entry.href}
								prefetch={false}
								title={[p.entry.time, p.entry.title, p.entry.note].filter(Boolean).join(" · ")}
								className={cn(
									APPS_CONFIG[p.entry.app].theme,
									"absolute top-(--top) left-(--left) h-(--h) w-(--w) overflow-hidden rounded-md border-l-2 border-primary bg-primary/15 px-1.5 py-1 text-xs leading-4 text-foreground outline-none transition-colors hover:bg-primary/25 focus-visible:ring-2 focus-visible:ring-ring",
								)}
								style={
									{
										"--top": `${((p.start - from * 60) / 60) * HOUR + 1}px`,
										"--h": `${((p.end - p.start) / 60) * HOUR - 2}px`,
										"--left": `calc(${(p.col / p.cols) * 100}% + 2px)`,
										"--w": `calc(${100 / p.cols}% - 4px)`,
									} as CSSProperties
								}
							>
								<span className="block tabular-nums text-muted-foreground">{p.entry.time}</span>
								<span className="line-clamp-2 font-medium">{p.entry.title}</span>
							</Link>
						))}
						{d.date === today && <NowLine from={from} to={to} hour={HOUR} />}
					</div>
				))}
			</div>
		</div>
	);
}
