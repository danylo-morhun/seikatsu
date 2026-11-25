import { cn } from "@seikatsu/ui";
import Link from "next/link";
import { Chip, Dot } from "@/features/calendar/components/parts";
import { type DayFigures, hrefOf } from "@/features/calendar/lib/calendar";
import { km, plural } from "@/features/home/lib/format";
import type { Money, WeekDay } from "@/features/week/lib/week";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
/** Rows a cell lists before folding the rest into "+n more". */
const SHOWN = 3;

/** A day behind, in a few words: what it added up to. */
function recap(f: DayFigures, money: Money): string[] {
	return [
		f.spent > 0 && money(f.spent),
		f.ticks > 0 && `${f.ticks}/${Math.max(f.ticks, f.expected)} habits`,
		f.cardsDone > 0 && plural(f.cardsDone, "card"),
		f.pages > 0 && `${f.pages} p.`,
		f.km > 0 && km(f.km),
	].filter((x): x is string => Boolean(x));
}

/**
 * The month in whole weeks. A day ahead lists what's planned on it; a day behind sums up what it
 * held (spent, habits, cards done…), with its rows a click away in the day view. Each cell opens
 * its day.
 */
export function MonthGrid({
	days,
	figures,
	month,
	today,
	money,
}: {
	days: WeekDay[];
	figures: Map<string, DayFigures>;
	/** "YYYY-MM": days outside it are quieter. */
	month: string;
	today: string;
	money: Money;
}) {
	return (
		<div className="group-card overflow-hidden p-0!">
			<div className="grid grid-cols-7 border-b border-rule text-[11px] text-muted-foreground">
				{WEEKDAYS.map((d) => (
					<div key={d} className="px-2 py-1.5">
						{d}
					</div>
				))}
			</div>
			<ol aria-label="Days" className="grid grid-cols-7">
				{days.map((d) => {
					const outside = d.date.slice(0, 7) !== month;
					const plan = d.plan;
					const lines = d.date <= today ? recap(figures.get(d.date) ?? EMPTY, money) : [];
					const date = Number(d.date.slice(8));
					return (
						<li
							key={d.date}
							className="relative min-h-16 border-r border-b border-rule p-1 sm:min-h-28 sm:p-1.5 [&:nth-child(7n)]:border-r-0"
						>
							<Link
								href={hrefOf("day", d.date, today)}
								prefetch={false}
								aria-label={`Open ${d.date}`}
								className="absolute inset-0 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
							/>
							<span
								className={cn(
									"relative flex size-6 items-center justify-center rounded-full text-xs tabular-nums",
									d.isToday
										? "bg-primary font-semibold text-primary-foreground"
										: outside
											? "text-muted-foreground/50"
											: "text-muted-foreground",
								)}
							>
								{date}
							</span>
							{/* A phone's cell: one dot per app with something on. */}
							<div className="relative mt-1 flex flex-wrap gap-0.5 sm:hidden">
								{[...new Set([...d.done, ...plan].map((e) => e.app))].map((app) => (
									<Dot key={app} app={app} />
								))}
							</div>
							<div
								className={cn("relative mt-1 space-y-0.5 max-sm:hidden", outside && "opacity-60")}
							>
								{lines.length > 0 && (
									<p className="truncate px-1 text-[11px] text-muted-foreground">
										{lines.join(" · ")}
									</p>
								)}
								{plan.slice(0, SHOWN).map((e) => (
									<Chip key={e.key} entry={e} />
								))}
								{plan.length > SHOWN && (
									<p className="px-1 text-[11px] text-muted-foreground">
										+{plan.length - SHOWN} more
									</p>
								)}
							</div>
						</li>
					);
				})}
			</ol>
		</div>
	);
}

const EMPTY: DayFigures = { spent: 0, ticks: 0, expected: 0, pages: 0, km: 0, cardsDone: 0 };
