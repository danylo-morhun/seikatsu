"use client";

import { addDays, mondayOf as weekStart } from "@/features/keizoku/lib/streak";
import { cn } from "@seikatsu/ui";
import { type CSSProperties, memo, useState } from "react";

/** A day on the map: 0 nothing done … 4 all of it; null = nothing was due (or before it began). */
export interface HeatDay {
	date: string;
	level: number | null;
	/** What the day says on hover and to a screen reader: "Thu, Oct 15 · 3 of 7 done". */
	text: string;
}

const LEVELS = ["bg-surface-2", "bg-primary/30", "bg-primary/50", "bg-primary/75", "bg-primary"];
const QUIET = "bg-surface-2/60";
const MONTH = new Intl.DateTimeFormat("en", { month: "short", timeZone: "UTC" });
const ROW_LABELS = ["Mon", "", "Wed", "", "Fri", "", ""];

/**
 * GitHub's contribution map, in lacquer: a column per week (Monday on top), months over the
 * weeks they begin in, the grid stretched to the full width so cells grow with the page. Phones
 * keep the 18 weeks up to `anchor`, small tablets 30; wider screens the whole span. Hovering a
 * day reads it out under the map; with `onToggle`, every past day is a button.
 */
export const Heatmap = memo(function Heatmap({
	from,
	to,
	anchor,
	today,
	days,
	summary,
	label,
	onToggle,
}: {
	/** First and last day shown (whole weeks around them are drawn). */
	from: string;
	to: string;
	/** The week phones keep in view: today, or the end of a past year. */
	anchor: string;
	today: string;
	days: HeatDay[];
	summary: React.ReactNode;
	label: string;
	onToggle?: (date: string) => void;
}) {
	const [hover, setHover] = useState<HeatDay | null>(null);
	const byDate = new Map(days.map((d) => [d.date, d]));

	const weeks: string[] = [];
	for (let w = weekStart(from); w <= to; w = addDays(w, 7)) weeks.push(w);
	const anchorWeek = Math.max(0, weeks.indexOf(weekStart(anchor)));
	// Which columns each screen keeps: the newest weeks up to the anchor.
	const keep = (i: number) =>
		cn(
			i > anchorWeek && "max-md:hidden",
			i < anchorWeek - 17 && "max-sm:hidden",
			i < anchorWeek - 29 && "sm:max-md:hidden",
		);
	// A month is named over the week holding its 1st; the first week names its own month
	// only when no 1st follows within two weeks (else the labels would collide).
	const firsts = weeks.map((w) =>
		Array.from({ length: 7 }, (_, d) => addDays(w, d)).find((d) => d.endsWith("-01")),
	);
	const months = weeks.map((w, i) => {
		const first = firsts[i];
		if (first) return MONTH.format(new Date(`${first}T00:00:00Z`));
		return i === 0 && !firsts[1] && !firsts[2] ? MONTH.format(new Date(`${w}T00:00:00Z`)) : "";
	});

	return (
		<div>
			<div
				role="group"
				aria-label={label}
				onMouseLeave={() => setHover(null)}
				className="grid gap-[3px] [--cols:var(--all)] max-sm:[--cols:18] sm:max-md:[--cols:30] md:gap-1"
				style={
					{
						"--all": weeks.length,
						gridTemplateColumns: "auto repeat(var(--cols), minmax(0, 1fr))",
					} as CSSProperties
				}
			>
				{/* Month row */}
				<span aria-hidden />
				{weeks.map((w, i) => (
					<span
						key={`m-${w}`}
						aria-hidden
						className={cn("relative h-4 text-[11px] leading-4 text-muted-foreground", keep(i))}
					>
						{months[i] && <span className="absolute left-0 whitespace-nowrap">{months[i]}</span>}
					</span>
				))}

				{/* A row per weekday, Monday first */}
				{ROW_LABELS.map((rowLabel, row) => (
					<Row
						key={rowLabel || `row-${row}`}
						row={row}
						rowLabel={rowLabel}
						weeks={weeks}
						keep={keep}
						byDate={byDate}
						today={today}
						to={to}
						onToggle={onToggle}
						onHover={setHover}
					/>
				))}
			</div>

			<div className="mt-3 flex items-center justify-between gap-4 text-xs text-muted-foreground">
				<p aria-live="polite" className="min-w-0 truncate font-figures">
					{hover ? <span className="text-foreground">{hover.text}</span> : summary}
				</p>
				<div aria-hidden className="flex shrink-0 items-center gap-1">
					<span className="mr-1">Less</span>
					{LEVELS.map((l) => (
						<span key={l} className={cn("size-2.5 rounded-[3px]", l)} />
					))}
					<span className="ml-1">More</span>
				</div>
			</div>
		</div>
	);
});

function Row({
	row,
	rowLabel,
	weeks,
	keep,
	byDate,
	today,
	to,
	onToggle,
	onHover,
}: {
	row: number;
	rowLabel: string;
	weeks: string[];
	keep: (i: number) => string;
	byDate: Map<string, HeatDay>;
	today: string;
	to: string;
	onToggle?: (date: string) => void;
	onHover: (day: HeatDay | null) => void;
}) {
	return (
		<>
			<span aria-hidden className="pr-2 text-[11px] leading-none text-muted-foreground self-center">
				{rowLabel}
			</span>
			{weeks.map((w, i) => {
				const date = addDays(w, row);
				const day = byDate.get(date);
				const style = { "--c": i } as CSSProperties;
				const base = cn("aspect-square w-full rounded-[22%]", keep(i));
				if (date > to || date > today || !day) {
					return <span key={date} aria-hidden className={base} />;
				}
				const fill = day.level == null ? QUIET : LEVELS[day.level];
				const look = cn(
					base,
					"animate-heat transition-[filter,box-shadow] duration-150",
					fill,
					date === today && "shadow-[inset_0_0_0_1.5px_var(--foreground)]",
				);
				return onToggle ? (
					<button
						key={date}
						type="button"
						aria-pressed={(day.level ?? 0) > 0}
						aria-label={day.text}
						style={style}
						onClick={() => onToggle(date)}
						onMouseEnter={() => onHover(day)}
						onFocus={() => onHover(day)}
						className={cn(
							look,
							"outline-none hover:brightness-125 focus-visible:ring-2 focus-visible:ring-ring",
						)}
					/>
				) : (
					<span
						key={date}
						role="img"
						aria-label={day.text}
						style={style}
						onMouseEnter={() => onHover(day)}
						className={cn(look, "hover:brightness-125")}
					/>
				);
			})}
		</>
	);
}
