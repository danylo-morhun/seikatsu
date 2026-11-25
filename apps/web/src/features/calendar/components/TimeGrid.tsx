import { cn } from "@seikatsu/ui";
import Link from "next/link";
import type { CSSProperties } from "react";
import { GridScroller } from "@/features/calendar/components/GridScroller";
import { NowLine } from "@/features/calendar/components/NowLine";
import { Chip, Kanji, Recap } from "@/features/calendar/components/parts";
import { type DayFigures, hoursOf, hrefOf, placeTimed } from "@/features/calendar/lib/calendar";
import type { Money, WeekDay, WeekEntry } from "@/features/week/lib/week";
import { APPS_CONFIG } from "@/lib/app-themes";

/** Rows a week's day lists above the hours before "n more" (the day view lists them all). */
const STRIP = 4;
/** One hour's height, in px (h-14). */
const HOUR = 56;
const HOURS = Array.from({ length: 24 }, (_, h) => h);

const WEEKDAY = new Intl.DateTimeFormat("en-GB", { weekday: "short", timeZone: "UTC" });
const utc = (iso: string) => new Date(`${iso}T00:00:00Z`);

const timed = (d: WeekDay) =>
	d.plan.filter((e): e is WeekEntry & { time: string } => Boolean(e.time));

/**
 * Days side by side over the whole day's hours, as a calendar does: rows with a time sit at it,
 * the rest (and what already happened) in the strip above; a day behind shows what it added up
 * to under its date. The hours scroll under a head that stays; it opens at the working day.
 */
export function TimeGrid({
	days,
	today,
	figures,
	money,
	strip = true,
}: {
	days: WeekDay[];
	today: string;
	figures: Map<string, DayFigures>;
	money: Money;
	/** The untimed rows above the hours; off where a list beside the grid holds them. */
	strip?: boolean;
}) {
	const { from } = hoursOf(days.flatMap((d) => timed(d).map((e) => e.time)));
	const cols = days.length;
	const grid = cn(
		"grid",
		cols === 7
			? "grid-cols-[3.25rem_repeat(7,minmax(0,1fr))]"
			: "grid-cols-[3.25rem_minmax(0,1fr)]",
	);

	return (
		<div className="group-card overflow-hidden p-0!">
			<GridScroller top={Math.max(0, from - 0.5) * HOUR}>
				{/* The days' heads and their all-day strip: they stay while the hours scroll. */}
				{strip && (
					<div
						className={cn(
							grid,
							"sticky top-0 z-20 border-b border-rule bg-[var(--group-bg)] classic:bg-background",
						)}
					>
						<div className="flex items-end justify-end border-r border-rule px-1.5 pb-2 text-[10px] text-muted-foreground">
							all day
						</div>
						{days.map((d) => {
							const untimed = [
								...d.plan.filter((e) => !e.time).map((e) => ({ e, done: false })),
								...d.done.map((e) => ({ e, done: true })),
							];
							const shown = cols > 1 ? untimed.slice(0, STRIP) : untimed;
							const figs = d.date <= today ? figures.get(d.date) : undefined;
							return (
								<div
									key={d.date}
									className={cn(
										"flex min-w-0 flex-col gap-1 border-r border-rule p-1.5 last:border-r-0",
										d.isToday && "bg-primary/[0.06]",
									)}
								>
									{cols > 1 && (
										<Link
											href={hrefOf("day", d.date, today)}
											prefetch={false}
											className="group/head flex items-center gap-2 rounded-md px-1 py-0.5 outline-none focus-visible:ring-2 focus-visible:ring-ring"
										>
											<span
												className={cn(
													"flex size-8 items-center justify-center rounded-full text-lg font-semibold tabular-nums tracking-tight transition-colors duration-150 ease-out",
													d.isToday
														? "bg-primary text-primary-foreground"
														: d.past
															? "text-muted-foreground group-hover/head:bg-surface-2"
															: "text-foreground group-hover/head:bg-surface-2",
												)}
											>
												{utc(d.date).getUTCDate()}
											</span>
											<span
												className={cn(
													"text-xs font-medium",
													d.isToday ? "text-primary" : "text-muted-foreground",
												)}
											>
												{WEEKDAY.format(utc(d.date))}
											</span>
										</Link>
									)}
									{figs && <Recap figures={figs} money={money} className="px-1" />}
									<div className="flex min-h-6 flex-col gap-0.5">
										{shown.map(({ e, done }) => (
											<Chip key={e.key} entry={e} done={done} />
										))}
										{untimed.length > shown.length && (
											<Link
												href={hrefOf("day", d.date, today)}
												prefetch={false}
												className="px-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground"
											>
												{untimed.length - shown.length} more
											</Link>
										)}
									</div>
								</div>
							);
						})}
					</div>
				)}

				{/* The hours. */}
				<div className={grid}>
					<div className="relative border-r border-rule">
						{HOURS.map((h) => (
							<div key={h} className="relative h-14">
								{h > 0 && (
									<span className="absolute -top-2 right-2 text-[10px] font-medium tabular-nums text-muted-foreground">
										{String(h).padStart(2, "0")}:00
									</span>
								)}
							</div>
						))}
					</div>
					{days.map((d) => (
						<div
							key={d.date}
							className={cn(
								"relative border-r border-rule last:border-r-0",
								d.isToday && "bg-primary/[0.035]",
								d.past && "bg-foreground/[0.015]",
							)}
						>
							{HOURS.map((h) => (
								<div
									key={h}
									className="h-14 border-t border-rule first:border-t-0 [background-image:linear-gradient(to_right,var(--rule)_50%,transparent_50%)] [background-position:0_50%] [background-repeat:repeat-x] [background-size:6px_1px]"
								/>
							))}
							{placeTimed(timed(d)).map((p) => (
								<Link
									key={p.entry.key}
									href={p.entry.href}
									prefetch={false}
									title={[p.entry.time, p.entry.title, p.entry.note].filter(Boolean).join(" · ")}
									className={cn(
										APPS_CONFIG[p.entry.app].theme,
										"absolute top-(--top) left-(--left) z-10 flex h-(--h) w-(--w) flex-col gap-0.5 overflow-hidden rounded-[0.5rem] bg-primary/22 px-2 py-1.5 text-xs leading-4 text-foreground outline-none ring-1 ring-background/60 transition-colors duration-150 ease-out hover:bg-primary/32 focus-visible:ring-2 focus-visible:ring-ring",
									)}
									style={
										{
											"--top": `${(p.start / 60) * HOUR + 1}px`,
											"--h": `${((p.end - p.start) / 60) * HOUR - 2}px`,
											"--left": `calc(${(p.col / p.cols) * 100}% + 3px)`,
											"--w": `calc(${100 / p.cols}% - 6px)`,
										} as CSSProperties
									}
								>
									<span className="flex items-center gap-1.5 text-[11px] tabular-nums text-muted-foreground">
										<Kanji app={p.entry.app} className="text-[10px]" />
										{p.entry.time}
									</span>
									<span className="line-clamp-2 font-semibold">{p.entry.title}</span>
									{p.entry.note && cols === 1 && (
										<span className="truncate text-muted-foreground">{p.entry.note}</span>
									)}
								</Link>
							))}
							{d.date === today && <NowLine from={0} to={24} hour={HOUR} />}
						</div>
					))}
				</div>
			</GridScroller>
		</div>
	);
}
