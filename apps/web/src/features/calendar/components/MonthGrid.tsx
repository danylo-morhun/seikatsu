import { cn } from "@seikatsu/ui";
import Link from "next/link";
import { NewOnDay } from "@/features/calendar/components/Events";
import { Chip, Recap, Seals } from "@/features/calendar/components/parts";
import { type DayFigures, hrefOf } from "@/features/calendar/lib/calendar";
import type { CalDay } from "@/features/calendar/lib/events";
import type { Money } from "@/features/week/lib/week";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
/** Rows a cell lists before folding the rest into "n more". */
const SHOWN = 3;

/**
 * The month in whole weeks. A day ahead lists what's planned on it; a day behind sums up what it
 * held, each figure sealed by its app; its rows are a click away in the day view. Each cell
 * opens its day.
 */
export function MonthGrid({
	days,
	figures,
	month,
	today,
	money,
}: {
	days: CalDay[];
	figures: Map<string, DayFigures>;
	/** "YYYY-MM": days outside it are quieter. */
	month: string;
	today: string;
	money: Money;
}) {
	const weeks = days.length / 7;
	return (
		<div className="group-card overflow-hidden p-0!">
			<div className="grid grid-cols-7 border-b border-rule">
				{WEEKDAYS.map((d, i) => (
					<div
						key={d}
						className={cn(
							"px-1 py-2 text-center text-[11px] font-medium text-muted-foreground sm:px-3 sm:text-left",
							i >= 5 && "text-muted-foreground/70",
						)}
					>
						{d}
					</div>
				))}
			</div>
			<ol
				aria-label="Days"
				className={cn(
					"grid grid-cols-7",
					// The month fills the screen on a desktop; a phone keeps its cells compact.
					weeks === 6
						? "md:h-[max(36rem,calc(100dvh-15rem))] md:grid-rows-6"
						: "md:h-[max(32rem,calc(100dvh-15rem))] md:grid-rows-5",
				)}
			>
				{days.map((d, i) => {
					const outside = d.date.slice(0, 7) !== month;
					const plan = d.plan;
					const figs = d.date <= today ? figures.get(d.date) : undefined;
					return (
						<li
							key={d.date}
							className={cn(
								"group/cell relative flex min-h-16 min-w-0 flex-col gap-1 border-rule p-1 transition-colors duration-150 ease-out hover:bg-surface/70 sm:min-h-28 sm:p-1.5",
								i % 7 !== 6 && "border-r",
								i < days.length - 7 && "border-b",
								(i % 7 >= 5 || d.past) && "bg-foreground/[0.018]",
							)}
						>
							<Link
								href={hrefOf("day", d.date, today)}
								prefetch={false}
								aria-label={`Open ${d.date}`}
								className="absolute inset-0 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
							/>
							<div className="relative flex items-center justify-center sm:justify-between">
								<span
									className={cn(
										"relative flex size-6 items-center justify-center rounded-full text-xs font-medium tabular-nums",
										d.isToday
											? "bg-primary font-semibold text-primary-foreground"
											: outside
												? "text-muted-foreground/40"
												: d.past
													? "text-muted-foreground"
													: "text-foreground",
									)}
								>
									{Number(d.date.slice(8))}
								</span>
								<NewOnDay date={d.date} label={d.date} />
							</div>
							{/* A phone's cell: the kanji of the apps with something on. */}
							<span className={cn("relative sm:hidden", outside && "opacity-40")}>
								<Seals apps={[...new Set([...plan, ...d.done].map((e) => e.app))]} />
							</span>
							<div
								className={cn(
									"relative flex min-h-0 flex-1 flex-col gap-0.5 overflow-hidden max-sm:hidden",
									outside && "opacity-45",
								)}
							>
								{figs && <Recap figures={figs} money={money} className="px-1 pb-0.5" />}
								{plan.slice(0, SHOWN).map((e) => (
									<Chip key={e.key} entry={e} />
								))}
								{plan.length > SHOWN && (
									<span className="px-1.5 text-[11px] font-medium text-muted-foreground group-hover/cell:text-foreground">
										{plan.length - SHOWN} more
									</span>
								)}
							</div>
						</li>
					);
				})}
			</ol>
		</div>
	);
}
