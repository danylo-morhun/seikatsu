"use client";

import { formatDay } from "@/features/keizoku/components/DayNoteDialog";
import { WeekGrid } from "@/features/keizoku/components/WeekGrid";
import { CALENDAR_WEEKS } from "@/features/keizoku/lib/constants";
import { type HabitSchedule, addDays, isScheduled } from "@/features/keizoku/lib/streak";
import { cn } from "@seikatsu/ui";
import { memo } from "react";

/**
 * One habit from its first week (up to a year), a column per week, today at the end. Every past
 * day is a button: tap a missed day to check it in, a done one to clear it. Days are calendar
 * strings from the server, so a day is the day it happened, whatever the browser's zone.
 */
/** Big enough to tap on a phone; the calendar scrolls to keep the newest weeks in view. */
const CELL = "size-[1.375rem] md:size-3.5";

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
	// From the habit's first week (a year at most, twelve weeks at least): no empty past.
	const earliest = [...done].reduce((min, d) => (d < min ? d : min), start);
	const yearAgo = addDays(today, -(CALENDAR_WEEKS - 1) * 7);
	const twelve = addDays(today, -11 * 7);
	const from = earliest < yearAgo ? yearAgo : earliest > twelve ? twelve : earliest;

	return (
		<WeekGrid
			from={from}
			to={today}
			cellClassName={CELL}
			label={`${done.size} ${done.size === 1 ? "day" : "days"} done`}
			cell={(date) => {
				const isDone = done.has(date);
				const counted = date >= start && date <= end;
				const due =
					counted && (isScheduled(habit, date) || habit.frequencyType === "times_per_week");
				const label = `${formatDay(date)} · ${isDone ? "done" : due ? "not done" : date < start ? "before it began" : "not due"}`;
				const className = cn(
					CELL,
					"rounded-[4px] transition-colors duration-150",
					isDone
						? "bg-primary/85 hover:bg-primary"
						: due
							? "bg-surface-2 hover:bg-primary/30"
							: "bg-surface/60 hover:bg-primary/20",
					date === today && "ring-1 ring-foreground/50",
				);
				return onToggle ? (
					<button
						type="button"
						aria-pressed={isDone}
						aria-label={label}
						title={label}
						onClick={() => onToggle(date)}
						className={cn(className, "outline-none focus-visible:ring-2 focus-visible:ring-ring")}
					/>
				) : (
					<span title={label} className={className} />
				);
			}}
		/>
	);
});
