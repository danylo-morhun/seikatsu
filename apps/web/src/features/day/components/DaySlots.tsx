"use client";

import { cn } from "@seikatsu/ui";
import Link from "next/link";
import type { DaySlot, SlotKey, TimelineEntry } from "@/features/day/lib/day";
import { HabitsToday } from "@/features/home/components/TodayIslands";
import type { HabitToday } from "@/features/home/lib/today";

/**
 * The day in its three parts: what happens at a time and the habits that belong there, ticked
 * in place. The part we're in is marked, with now among its times.
 */
export function DaySlots({
	slots,
	current,
	now,
	today,
}: {
	slots: DaySlot<HabitToday>[];
	current: SlotKey;
	/** Minutes since local midnight when the page was made. */
	now: number;
	today: string;
}) {
	if (slots.length === 0) return null;
	return (
		<section aria-label="The day" className="space-y-4">
			{slots.map((slot) => {
				const isNow = slot.key === current;
				const nowAt = isNow ? slot.entries.findIndex((e) => toMinutes(e.time) > now) : -2;
				return (
					<div key={slot.key} aria-label={slot.label} role="group">
						<h3
							className={cn(
								"mb-1 flex items-center gap-2 px-1 text-xs font-medium tracking-wide uppercase",
								isNow ? "text-primary" : "text-muted-foreground",
							)}
						>
							{slot.label}
							{isNow && (
								<span className="rounded-button bg-primary/15 px-1.5 py-px text-[10px] normal-case tracking-normal">
									now
								</span>
							)}
						</h3>
						<div className="group-card space-y-0.5">
							{slot.entries.length > 0 && (
								<ol>
									{slot.entries.map((e, i) => (
										<li key={e.key}>
											{i === nowAt && <NowMark now={now} />}
											<TimeRow entry={e} past={toMinutes(e.time) <= now} />
										</li>
									))}
									{nowAt === -1 && slot.entries.length > 0 && (
										<li>
											<NowMark now={now} />
										</li>
									)}
								</ol>
							)}
							{slot.habits.length > 0 && <HabitsToday habits={slot.habits} today={today} />}
						</div>
					</div>
				);
			})}
		</section>
	);
}

const toMinutes = (time: string) => {
	const [h, m] = time.split(":").map(Number);
	return (h ?? 0) * 60 + (m ?? 0);
};

const hhmm = (minutes: number) =>
	`${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

function NowMark({ now }: { now: number }) {
	return (
		<div aria-hidden className="flex items-center gap-3 py-1">
			<span className="w-11 font-figures text-xs font-medium tabular-nums text-primary">
				{hhmm(now)}
			</span>
			<span className="h-px flex-1 bg-primary" />
		</div>
	);
}

function TimeRow({ entry, past }: { entry: TimelineEntry; past: boolean }) {
	const body = (
		<>
			<span className="w-11 shrink-0 font-figures text-xs tabular-nums text-muted-foreground">
				{entry.time}
			</span>
			<span className={cn("truncate text-sm", past && "text-muted-foreground")}>{entry.title}</span>
		</>
	);
	return entry.href ? (
		<Link
			href={entry.href}
			prefetch
			className="flex min-h-10 items-center gap-3 transition-colors hover:text-primary"
		>
			{body}
		</Link>
	) : (
		<div className="flex min-h-10 items-center gap-3">{body}</div>
	);
}
