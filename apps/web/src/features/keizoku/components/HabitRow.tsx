"use client";

import type { TodayHabit } from "@/features/keizoku/actions/logs";
import { formatDay } from "@/features/keizoku/lib/constants";
import { scheduleLabel } from "@/features/keizoku/lib/constants";
import { takeFresh } from "@/features/keizoku/lib/habit-nav";
import { isScheduled, runUnit } from "@/features/keizoku/lib/streak";
import { cn } from "@seikatsu/ui";
import Link from "next/link";
import { type CSSProperties, memo, useState } from "react";

const stagger = (index: number) => ({ "--i": Math.min(index, 8) }) as CSSProperties;

/** The one daily action: a 22px round check as in Reminders (40px to tap), the pigment when done, the tick drawn in. */
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
				// The circle is the whole box, so rows inset it like any other content; the hit area
				// still reaches 40px through ::before.
				"group/check relative flex size-[22px] shrink-0 items-center justify-center rounded-full outline-none before:absolute before:-inset-[9px] before:content-[''] focus-visible:ring-2 focus-visible:ring-ring",
				className,
			)}
		>
			<span
				aria-hidden
				className={cn(
					"flex size-[22px] items-center justify-center rounded-full transition-[background-color,box-shadow,transform] duration-150 ease-out group-active/check:scale-[0.94]",
					done
						? "bg-primary text-primary-foreground"
						: "shadow-[inset_0_0_0_1.5px_color-mix(in_oklch,var(--muted-foreground)_60%,transparent)] group-hover/check:bg-primary/10 group-hover/check:shadow-[inset_0_0_0_1.5px_var(--primary)]",
				)}
			>
				{done && (
					<svg
						viewBox="0 0 12 12"
						className="size-3"
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

const NARROW = new Intl.DateTimeFormat("en", { weekday: "narrow", timeZone: "UTC" });
const SHORT = new Intl.DateTimeFormat("en", { weekday: "short", timeZone: "UTC" });
/** The day over a strip column: "T" on a phone, "Tue" from md (so Tue and Thu differ). */
export function DayLetter({ date }: { date: string }) {
	const d = new Date(`${date}T00:00:00Z`);
	return (
		<>
			<span className="md:hidden">{NARROW.format(d)}</span>
			<span className="max-md:hidden">{SHORT.format(d)}</span>
		</>
	);
}

/**
 * A row: the check, the name, the run, the week. On phones the week runs under the name and
 * the run joins the name's second line; from md they're columns, lined up under one header,
 * and the week grows with the screen.
 */
export const ROW_GRID =
	"grid grid-cols-[1.375rem_minmax(0,1fr)] gap-x-3 md:grid-cols-[1.375rem_minmax(0,1fr)_7.5rem_auto] lg:grid-cols-[1.375rem_minmax(0,1fr)_9rem_auto]";
export const RUN_COL = "max-md:hidden text-right md:pr-3";
export const STRIP =
	"grid grid-cols-7 gap-0.5 max-md:col-start-2 max-md:w-full max-md:max-w-64 md:w-[15rem] md:gap-1 lg:w-[20rem] xl:w-[24rem]";

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
				// A weekly target has no fixed day, so an open day isn't a miss.
				const free = habit.frequencyType === "times_per_week";
				const state = d.done ? "done" : before || off || free ? "quiet" : "missed";
				return (
					<button
						key={d.date}
						type="button"
						aria-pressed={d.done}
						aria-label={`${formatDay(d.date)}: ${dayWord(d.done, off, before)}`}
						title={`${formatDay(d.date)} · ${dayWord(d.done, off, before)}`}
						onClick={() => onToggle(d.date)}
						className="group/day flex min-h-9 items-center md:min-h-10 justify-center rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
					>
						<span
							aria-hidden
							className={cn(
								"aspect-square w-full max-w-7 rounded-[22%] transition-[background-color,box-shadow,filter] duration-150 ease-out md:aspect-auto md:h-7 md:max-w-none md:rounded-md",
								state === "done" && "bg-primary/80 group-hover/day:bg-primary",
								state === "missed" && "bg-surface-2 group-hover/day:bg-primary/25",
								state === "quiet" &&
									"shadow-[inset_0_0_0_1px_var(--rule)] group-hover/day:bg-primary/15",
								// Today is outlined while it's still open — not on a day off or before the start.
								d.date === today &&
									!d.done &&
									!off &&
									!before &&
									"shadow-[inset_0_0_0_1.5px_var(--muted-foreground)]",
							)}
						/>
					</button>
				);
			})}
		</div>
	);
}

const dayWord = (done: boolean, off: boolean, before: boolean) =>
	done ? "done" : off ? "not due" : before ? "before it began" : "not done";

/** The run column: the figure that matters, its unit beside it, the best under it. */
function RunFigure({ item }: { item: TodayHabit }) {
	const { habit, streak, week } = item;
	if (habit.frequencyType === "times_per_week") {
		const target = habit.frequencyTarget ?? 1;
		return (
			<span className={RUN_COL}>
				<span className="block font-figures text-sm font-medium">
					{Math.min(week, target)}
					<span className="text-muted-foreground"> / {target}</span>
				</span>
				<span className="block text-[11px] text-muted-foreground">this week</span>
			</span>
		);
	}
	// No run going: only the best one, quietly — a row of zeros says nothing.
	if (streak.current === 0) {
		return (
			<span className={cn(RUN_COL, "font-figures text-xs text-muted-foreground")}>
				{streak.best > 0 ? `best ${streak.best}` : "—"}
			</span>
		);
	}
	return (
		<span className={RUN_COL}>
			<span className="block font-figures text-sm font-medium">
				{streak.current}{" "}
				<span className="text-xs font-normal text-muted-foreground">
					{runUnit(habit, streak.current)}
				</span>
			</span>
			{streak.best > streak.current && (
				<span className="block font-figures text-[11px] text-muted-foreground">
					best {streak.best}
				</span>
			)}
		</span>
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
	return streak.current > 0 ? `${streak.current}-${runUnit(habit, 1)} run` : "";
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
					"items-center py-1.5 max-md:pb-0.5 md:-mx-2 md:px-2 md:hover:bg-(--row-hover) md:rounded-md",
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
							"flex items-center gap-2 text-sm font-medium transition-colors duration-200",
							// Done for today, or not due: the row steps back so what's left stands out.
							(!due || today.done) && "text-muted-foreground",
						)}
					>
						<span
							aria-hidden
							className={cn(
								"shrink-0 text-base leading-none transition-opacity duration-200",
								(!due || today.done) && "opacity-55",
							)}
						>
							{habit.emoji}
						</span>
						<span className="truncate">{habit.name}</span>
					</span>
					<span className="mt-0.5 block truncate text-xs text-muted-foreground">
						{scheduleLabel(habit)}
						{progress && <span className="md:hidden"> · {progress}</span>}
					</span>
				</Link>
				<RunFigure item={item} />
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
