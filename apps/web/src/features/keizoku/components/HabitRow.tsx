"use client";

import type { TodayHabit } from "@/features/keizoku/actions/logs";
import { formatDay } from "@/features/keizoku/components/DayNoteDialog";
import { scheduleLabel } from "@/features/keizoku/lib/constants";
import { takeFresh } from "@/features/keizoku/lib/habit-nav";
import { isScheduled, runUnit } from "@/features/keizoku/lib/streak";
import { cn } from "@seikatsu/ui";
import Link from "next/link";
import { type CSSProperties, memo, useState } from "react";

const stagger = (index: number) => ({ "--i": Math.min(index, 8) }) as CSSProperties;

/** The one daily action: a round check, the pigment when done, the tick drawn in. */
export function CheckButton({
	done,
	label,
	onClick,
	className,
}: {
	done: boolean;
	label: string;
	onClick: () => void;
	className?: string;
}) {
	return (
		<button
			type="button"
			aria-pressed={done}
			aria-label={label}
			aria-keyshortcuts="X"
			onClick={onClick}
			className={cn(
				"group/check relative flex size-10 shrink-0 items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring",
				className,
			)}
		>
			<span
				aria-hidden
				className={cn(
					"flex size-7 items-center justify-center rounded-full transition-[background-color,box-shadow,transform] duration-150 ease-out group-active/check:scale-[0.94]",
					done
						? "bg-primary text-primary-foreground"
						: "shadow-[inset_0_0_0_1.5px_var(--input)] group-hover/check:shadow-[inset_0_0_0_1.5px_var(--muted-foreground)]",
				)}
			>
				{done && (
					<svg
						viewBox="0 0 12 12"
						className="size-3.5"
						fill="none"
						stroke="currentColor"
						strokeWidth="1.75"
						strokeLinecap="round"
						strokeLinejoin="round"
					>
						<path
							d="M2 6l3 3 5-5"
							pathLength={1}
							className="[stroke-dasharray:1] animate-[check-draw_240ms_var(--ease-out)_backwards] motion-reduce:animate-none"
						/>
					</svg>
				)}
			</span>
		</button>
	);
}

const LETTER = new Intl.DateTimeFormat("en", { weekday: "narrow", timeZone: "UTC" });
export const dayLetter = (date: string) => LETTER.format(new Date(`${date}T00:00:00Z`));

/**
 * A row: the check, the name, the week. On phones the week runs under the name (the name
 * keeps the width); from md it's a fixed column, so every row's days line up under one header.
 */
export const ROW_GRID =
	"grid grid-cols-[2.5rem_minmax(0,1fr)] gap-x-3 md:grid-cols-[2.5rem_minmax(0,1fr)_auto]";
export const STRIP =
	"grid grid-cols-7 gap-0.5 max-md:col-start-2 max-md:w-full max-md:max-w-64 md:w-[13.25rem]";

/**
 * The last seven days, today last. Each is a button: a missed day can be checked in later,
 * a checked one cleared. Days before the habit began, or off its schedule, sit quieter.
 */
function WeekStrip({
	item,
	name,
	onToggle,
}: {
	item: TodayHabit;
	name: string;
	onToggle: (date: string) => void;
}) {
	const { habit, days, start } = item;
	const today = days.at(-1)?.date;
	return (
		<div role="group" aria-label={`${name}, the last 7 days`} className={STRIP}>
			{days.map((d) => {
				const before = d.date < start;
				const off = habit.frequencyType === "weekdays" && !isScheduled(habit, d.date);
				const state = d.done ? "done" : before || off ? "quiet" : "missed";
				return (
					<button
						key={d.date}
						type="button"
						aria-pressed={d.done}
						aria-label={`${formatDay(d.date)}: ${d.done ? "done" : off ? "not due" : "not done"}`}
						title={`${formatDay(d.date)} · ${d.done ? "done" : off ? "not due" : before ? "before it began" : "not done"}`}
						onClick={() => onToggle(d.date)}
						className="group/day flex h-9 items-center md:h-10 justify-center rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
					>
						<span
							aria-hidden
							className={cn(
								"h-6 w-full max-w-7 rounded-[5px] transition-[background-color,box-shadow] duration-150 ease-out md:size-6",
								state === "done" && "bg-primary/80 group-hover/day:bg-primary",
								state === "missed" && "bg-surface-2 group-hover/day:bg-primary/25",
								state === "quiet" &&
									"shadow-[inset_0_0_0_1px_var(--rule)] group-hover/day:bg-primary/15",
								d.date === today && !d.done && "shadow-[inset_0_0_0_1.5px_var(--muted-foreground)]",
							)}
						/>
					</button>
				);
			})}
		</div>
	);
}

/** "3-day run", "2 of 3 this week", or the best run when the current one is broken. */
function progressLine({ habit, streak, week }: TodayHabit): string {
	if (habit.frequencyType === "times_per_week") {
		const target = habit.frequencyTarget ?? 1;
		const run =
			streak.current > 1 ? ` · ${streak.current} ${runUnit(habit, streak.current)} running` : "";
		return `${Math.min(week, target)} of ${target} this week${run}`;
	}
	if (streak.current > 0) return `${streak.current}-${runUnit(habit, 1)} run`;
	if (streak.best > 1) return `Best run ${streak.best} ${runUnit(habit, streak.best)}`;
	return "";
}

/**
 * A habit on Today: the check, the name (a link to its page, and what the keys act on), its
 * schedule and run, and the week. Hairline row, no box.
 */
export const HabitRow = memo(
	function HabitRow({
		item,
		index,
		onToggle,
	}: {
		item: TodayHabit;
		index: number;
		onToggle: (habitId: string, date: string) => void;
	}) {
		const [fresh] = useState(() => takeFresh(item.habit.id));
		const { habit, days, due } = item;
		const today = days[days.length - 1];
		const progress = progressLine(item);

		return (
			<li
				data-habit-row
				className={cn(
					ROW_GRID,
					"items-center py-1.5 max-md:pb-0.5 md:-mx-2 md:px-2 md:hover:bg-surface/60 md:rounded-md",
					fresh ? "animate-drop" : "animate-rise",
				)}
				style={stagger(index)}
			>
				<CheckButton
					done={today.done}
					label={`${habit.name}: ${today.done ? "done today" : "mark done today"}`}
					onClick={() => onToggle(habit.id, today.date)}
				/>
				<Link
					href={`/keizoku/${habit.id}`}
					prefetch={false}
					data-habit-id={habit.id}
					className="min-w-0 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
				>
					<span
						className={cn(
							"flex items-center gap-2 text-sm font-medium",
							!due && "text-muted-foreground",
						)}
					>
						<span aria-hidden className="shrink-0 text-base leading-none">
							{habit.emoji}
						</span>
						<span className="truncate">{habit.name}</span>
					</span>
					<span className="mt-0.5 block truncate text-xs text-muted-foreground">
						{[scheduleLabel(habit), progress].filter(Boolean).join(" · ")}
					</span>
				</Link>
				<WeekStrip item={item} name={habit.name} onToggle={(date) => onToggle(habit.id, date)} />
			</li>
		);
	},
	(a, b) =>
		a.index === b.index &&
		a.onToggle === b.onToggle &&
		a.item.habit === b.item.habit &&
		a.item.days.every(
			(d, i) => d.done === b.item.days[i]?.done && d.date === b.item.days[i]?.date,
		) &&
		a.item.streak.current === b.item.streak.current &&
		a.item.week === b.item.week,
);
