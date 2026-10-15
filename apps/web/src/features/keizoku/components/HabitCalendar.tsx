"use client";

import { formatDay } from "@/features/keizoku/components/DayNoteDialog";
import { CALENDAR_WEEKS } from "@/features/keizoku/lib/constants";
import { type HabitSchedule, addDays, isScheduled, weekday } from "@/features/keizoku/lib/streak";
import { cn } from "@seikatsu/ui";
import { memo } from "react";

/**
 * A year of one habit, a column per week (Monday on top), today at the right edge. Every past
 * day is a button: tap a missed day to check it in, a done one to clear it. Days are calendar
 * strings from the server, so a day is the day it happened, whatever the browser's zone.
 */
export const HabitCalendar = memo(function HabitCalendar({
	habit,
	done,
	today,
	start,
	end,
	onToggle,
}: {
	habit: HabitSchedule;
	done: Set<string>;
	today: string;
	start: string;
	/** The last day it counted (archived, or today). */
	end: string;
	onToggle?: (date: string) => void;
}) {
	const monday = addDays(today, -((weekday(today) + 6) % 7));
	const first = addDays(monday, -(CALENDAR_WEEKS - 1) * 7);
	const cells: string[] = [];
	for (let d = first; cells.length < CALENDAR_WEEKS * 7; d = addDays(d, 1)) cells.push(d);

	return (
		// Right-to-left scrolling keeps the newest weeks in view on a phone; the grid reads ltr.
		<div className="-mx-4 overflow-x-auto px-4 pb-1 [direction:rtl] [scrollbar-width:thin] sm:mx-0 sm:px-0 sm:[direction:ltr]">
			<div
				role="group"
				aria-label={`${done.size} ${done.size === 1 ? "day" : "days"} done in the last year`}
				className="inline-grid grid-flow-col grid-rows-7 gap-[3px] [direction:ltr]"
			>
				{cells.map((date) => {
					if (date > today) return <span key={date} aria-hidden className="size-3" />;
					const isDone = done.has(date);
					const counted = date >= start && date <= end;
					const due = counted && isScheduled(habit, date);
					const label = `${formatDay(date)} · ${isDone ? "done" : due ? "missed" : "not due"}`;
					const className = cn(
						"size-3 rounded-[3px] transition-colors duration-150",
						isDone
							? "bg-primary/85 hover:bg-primary"
							: due || (counted && habit.frequencyType === "times_per_week")
								? "bg-surface-2 hover:bg-primary/30"
								: "bg-surface/60 hover:bg-primary/20",
						date === today && "ring-1 ring-foreground/50",
					);
					return onToggle ? (
						<button
							key={date}
							type="button"
							aria-pressed={isDone}
							aria-label={label}
							title={label}
							onClick={() => onToggle(date)}
							className={cn(className, "outline-none focus-visible:ring-2 focus-visible:ring-ring")}
						/>
					) : (
						<span key={date} title={label} className={className} />
					);
				})}
			</div>
		</div>
	);
});
