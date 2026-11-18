// Today below the capture line, shaped by where the day is: before it's planned, an invitation
// to the morning and the full list; once planned, the picks and the day's parts (times and
// habits) with the rest folded away; from the evening on, the close; then a quiet line.

import { cn } from "@seikatsu/ui";
import Link from "next/link";
import { DayKey } from "@/features/day/components/DayKey";
import { DaySlots } from "@/features/day/components/DaySlots";
import { Invite } from "@/features/day/components/Invite";
import { MyDay } from "@/features/day/components/MyDay";
import { getUserMinutes, loadDay, readEvening } from "@/features/day/lib/data";
import { dayPhase, daySlots, slotOf, timeline } from "@/features/day/lib/day";
import { TodayQueue } from "@/features/home/components/TodayQueue";
import { plural } from "@/features/home/lib/format";
import type { Money } from "@/features/home/lib/queue";
import { loadHabits } from "@/features/home/lib/today";
import type { Workspace } from "@/lib/session";

export async function DayBody({
	ws,
	today,
	fmt,
	showHabits,
}: {
	ws: Workspace;
	today: string;
	fmt: Money;
	/** Keizoku isn't set aside: its habits sit on the day's parts. */
	showHabits: boolean;
}) {
	const [day, evening, now, habits] = await Promise.all([
		loadDay(ws, today, fmt),
		readEvening(ws.id),
		getUserMinutes(),
		showHabits ? loadHabits() : null,
	]);
	const phase = dayPhase(day.plan, now, evening.time);
	// Planned with picks: they're the day and the list folds away. Planned with none, the list is.
	const planned = Boolean(day.plan?.plannedAt) && day.picks.length > 0;
	const waiting = day.queue.filter((q) => q.tone !== "info").length;
	const left = day.picks.filter((p) => !p.done).length;
	// What's picked is up top; the list holds the rest.
	const picked = new Set(planned ? day.picks.map((p) => p.key) : []);
	const rest = day.queue.filter((q) => !picked.has(q.key));
	const slots = daySlots(
		timeline(day.queue, { time: evening.time, closed: phase === "closed" }),
		habits?.habits ?? [],
		evening.time,
	);

	return (
		<div className="space-y-6 md:space-y-8">
			{phase === "plan" && (
				<Invite
					href="/morning"
					eyebrow="Morning"
					title="Plan the day"
					note={
						waiting > 0
							? `${plural(waiting, "thing")} waiting. Sort them, pick up to three.`
							: "Pick up to three things for today."
					}
				/>
			)}
			{phase === "close" && (
				<Invite
					href="/evening"
					eyebrow="Evening"
					title="Close the day"
					note={[
						planned && `${day.picks.length - left}/${day.picks.length} of my day done`,
						"log habits and pages, sort what's left",
					]
						.filter(Boolean)
						.join(" · ")}
					evening
				/>
			)}
			{phase === "closed" && (
				<p className="px-1 text-sm text-muted-foreground">
					Day closed.{" "}
					<Link href="/evening" prefetch className="underline-offset-2 hover:underline">
						See tomorrow
					</Link>
				</p>
			)}

			<div className="grid gap-6 md:gap-8 lg:grid-cols-2">
				{phase !== "closed" && (
					<div className="min-w-0 space-y-6 md:space-y-8">
						{planned && <MyDay day={today} picks={day.picks} />}
						<DaySlots slots={slots} current={slotOf(now, evening.time)} now={now} today={today} />
					</div>
				)}
				<section
					aria-label="To do"
					className={cn("min-w-0", !planned && phase !== "closed" && "max-lg:order-first")}
				>
					{!planned && phase !== "closed" && (
						<h2 className="mb-2 px-1 text-sm font-medium text-muted-foreground">To do</h2>
					)}
					<TodayQueue
						items={rest}
						workspaceId={ws.id}
						today={today}
						folded={planned || phase === "closed"}
					/>
				</section>
			</div>
			{(phase === "plan" || phase === "close") && (
				<DayKey href={phase === "plan" ? "/morning" : "/evening"} />
			)}
		</div>
	);
}
