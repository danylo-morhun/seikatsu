import { cn } from "@seikatsu/ui";
import Link from "next/link";
import type { CSSProperties } from "react";
import { Row } from "@/features/calendar/components/parts";
import { hrefOf } from "@/features/calendar/lib/calendar";
import type { WeekDay, WeekEntry } from "@/features/week/lib/week";

const DAY = new Intl.DateTimeFormat("en-GB", {
	weekday: "long",
	day: "numeric",
	month: "short",
	timeZone: "UTC",
});
const utc = (iso: string) => new Date(`${iso}T00:00:00Z`);

/** Timed rows first, by time; the rest after, as they came. */
const byTime = (rows: WeekEntry[]) =>
	[...rows].sort((a, b) => (a.time ?? "99").localeCompare(b.time ?? "99"));

/**
 * Days as a list, the way a phone reads a calendar: each day with something on it, what's
 * planned by time, then what happened. Empty days drop out, except today.
 */
export function DayList({ days, today }: { days: WeekDay[]; today: string }) {
	const shown = days.filter((d) => d.isToday || d.done.length + d.plan.length > 0);
	if (shown.length === 0)
		return (
			<p className="rounded-group bg-[var(--group-bg)] px-[var(--group-px)] py-3.5 text-sm text-muted-foreground">
				Nothing on these days.
			</p>
		);
	return (
		<ol aria-label="Days" className="space-y-5">
			{shown.map((d, i) => (
				<li
					key={d.date}
					className="grid animate-rise gap-2 md:grid-cols-[10rem_minmax(0,1fr)] md:gap-4"
					style={{ "--i": Math.min(i, 8) } as CSSProperties}
				>
					<h2 className="px-1 text-sm md:pt-4">
						<Link
							href={hrefOf("day", d.date, today)}
							prefetch={false}
							className={cn(
								"hover:underline",
								d.isToday ? "font-semibold text-foreground" : "text-muted-foreground",
							)}
						>
							{DAY.format(utc(d.date)).replace(",", "")}
						</Link>
						{d.isToday && <span className="ml-2 text-primary">Today</span>}
					</h2>
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
						<p className="rounded-group bg-[var(--group-bg)] px-[var(--group-px)] py-3.5 text-sm text-muted-foreground">
							Nothing planned
						</p>
					)}
				</li>
			))}
		</ol>
	);
}
