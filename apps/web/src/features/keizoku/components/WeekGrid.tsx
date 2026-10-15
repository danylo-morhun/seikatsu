// No hooks or "use client": the year page renders it on the server, the habit page in the client.
import { addDays, weekday } from "@/features/keizoku/lib/streak";
import { cn } from "@seikatsu/ui";

const MONTH = new Intl.DateTimeFormat("en", { month: "short", timeZone: "UTC" });
// Monday on top; label every other row, as calendars of this kind do.
const ROWS = ["Mon", "", "Wed", "", "Fri", "", ""];

/** Monday of the week holding `date`. */
export const weekStart = (date: string) => addDays(date, -((weekday(date) + 6) % 7));

/**
 * Days as weeks, a column each (Monday on top), from the week of `from` to the week of `to`,
 * with the month named over the first week that starts in it. Scrolls on a phone with the
 * newest weeks in view; `cell` draws each day (null after `to`).
 */
export function WeekGrid({
	from,
	to,
	cellClassName,
	label,
	cell,
}: {
	from: string;
	to: string;
	/** Size of a day; the labels line up with it. */
	cellClassName: string;
	label: string;
	cell: (date: string) => React.ReactNode;
}) {
	const weeks: string[] = [];
	for (let w = weekStart(from); w <= to; w = addDays(w, 7)) weeks.push(w);
	let lastMonth = "";

	return (
		<div className="-mx-4 overflow-x-auto px-4 pb-1 [direction:rtl] [scrollbar-width:thin] sm:mx-0 sm:px-0 sm:[direction:ltr]">
			<div role="group" aria-label={label} className="inline-flex gap-[3px] [direction:ltr]">
				<div
					aria-hidden
					className="mr-1 flex flex-col gap-[3px] pt-[19px] text-[11px] text-muted-foreground"
				>
					{ROWS.map((r, i) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: fixed 7 weekday rows, never reordered
						<span key={i} className={cn(cellClassName, "flex w-auto items-center leading-none")}>
							{r}
						</span>
					))}
				</div>
				{weeks.map((w) => {
					// The month is named over the week holding its 1st (or the grid's first week).
					const days = Array.from({ length: 7 }, (_, i) => addDays(w, i));
					const first = days.find((d) => d.endsWith("-01"));
					// The grid's first week names its month only if the next one doesn't start a month.
					const nextStartsMonth = Array.from({ length: 7 }, (_, i) => addDays(w, 7 + i)).some((d) =>
						d.endsWith("-01"),
					);
					const month = first
						? MONTH.format(new Date(`${first}T00:00:00Z`))
						: lastMonth || nextStartsMonth
							? ""
							: MONTH.format(new Date(`${w}T00:00:00Z`));
					if (month) lastMonth = month;
					return (
						<div key={w} className="flex flex-col gap-[3px]">
							<span
								aria-hidden
								className={cn(
									cellClassName,
									"relative h-4 text-[11px] leading-4 text-muted-foreground",
								)}
							>
								{month && <span className="absolute left-0 whitespace-nowrap">{month}</span>}
							</span>
							{days.map((d) =>
								d > to ? (
									<span key={d} aria-hidden className={cellClassName} />
								) : (
									<span key={d} className="contents">
										{cell(d)}
									</span>
								),
							)}
						</div>
					);
				})}
			</div>
		</div>
	);
}
