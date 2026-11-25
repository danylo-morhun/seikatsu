import { cn } from "@seikatsu/ui";
import Link from "next/link";
import type { CSSProperties } from "react";
import { Recap, Row } from "@/features/calendar/components/parts";
import { type DayFigures, hrefOf } from "@/features/calendar/lib/calendar";
import type { Money, WeekDay, WeekEntry } from "@/features/week/lib/week";

const WEEKDAY = new Intl.DateTimeFormat("en-GB", { weekday: "short", timeZone: "UTC" });
const MONTH = new Intl.DateTimeFormat("en-GB", { month: "short", timeZone: "UTC" });
const utc = (iso: string) => new Date(`${iso}T00:00:00Z`);

/** Timed rows first, by time; the rest after, as they came. */
const byTime = (rows: WeekEntry[]) =>
	[...rows].sort((a, b) => (a.time ?? "99").localeCompare(b.time ?? "99"));

/**
 * Days as a list, the way a phone reads a calendar: the date large at the left, what's planned
 * by time, then what happened, with a day behind's figures under its date. Empty days drop
 * out, except today.
 */
export function DayList({
	days,
	today,
	figures,
	money,
}: {
	days: WeekDay[];
	today: string;
	figures: Map<string, DayFigures>;
	money: Money;
}) {
	const shown = days.filter((d) => d.isToday || d.done.length + d.plan.length > 0);
	// One day (the day view): its date is the page's title, so the list stands alone.
	const single = days.length === 1;
	if (shown.length === 0)
		return (
			<p className="rounded-group bg-[var(--group-bg)] px-[var(--group-px)] py-6 text-center text-sm text-muted-foreground">
				Nothing on these days.
			</p>
		);
	return (
		<ol aria-label="Days" className="space-y-6">
			{shown.map((d, i) => {
				const figs = d.date <= today ? figures.get(d.date) : undefined;
				return (
					<li
						key={d.date}
						className={cn(
							"grid animate-rise",
							!single &&
								"grid-cols-[3.25rem_minmax(0,1fr)] gap-3 md:grid-cols-[4.5rem_minmax(0,1fr)] md:gap-5",
						)}
						style={{ "--i": Math.min(i, 8) } as CSSProperties}
					>
						<h2 className={cn("pt-2.5", single && "sr-only")}>
							<Link
								href={hrefOf("day", d.date, today)}
								prefetch={false}
								aria-label={d.date}
								className="group/date flex flex-col items-center gap-0.5 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
							>
								<span
									className={cn(
										"text-[11px] font-medium uppercase tracking-wide",
										d.isToday ? "text-primary" : "text-muted-foreground",
									)}
								>
									{WEEKDAY.format(utc(d.date))}
								</span>
								<span
									className={cn(
										"flex size-10 items-center justify-center rounded-full text-xl font-semibold tabular-nums tracking-tight transition-colors duration-150 ease-out",
										d.isToday
											? "bg-primary text-primary-foreground"
											: d.past
												? "text-muted-foreground group-hover/date:bg-surface-2"
												: "text-foreground group-hover/date:bg-surface-2",
									)}
								>
									{utc(d.date).getUTCDate()}
								</span>
								{(d.date.slice(8) === "01" || i === 0) && (
									<span className="text-[11px] text-muted-foreground">
										{MONTH.format(utc(d.date))}
									</span>
								)}
							</Link>
						</h2>
						<div className="min-w-0 space-y-2">
							{d.done.length + d.plan.length > 0 ? (
								<ul className="inset-group">
									{byTime(d.plan).map((e) => (
										<Row key={e.key} entry={e} />
									))}
									{d.done.map((e) => (
										<Row key={e.key} entry={e} done />
									))}
								</ul>
							) : (
								<p className="flex min-h-14 items-center rounded-group bg-[var(--group-bg)] px-[var(--group-px)] text-sm text-muted-foreground">
									Nothing planned
								</p>
							)}
							{figs && <Recap figures={figs} money={money} className="px-1" />}
						</div>
					</li>
				);
			})}
		</ol>
	);
}
