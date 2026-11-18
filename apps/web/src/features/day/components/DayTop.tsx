// Today's top: where the day is. Before it's planned, an invitation to the morning; while it
// runs, the picks and today's times; from the evening on, the close; then a quiet line.

import { ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { cn } from "@seikatsu/ui";
import Link from "next/link";
import { DayKey } from "@/features/day/components/DayKey";
import { MyDay } from "@/features/day/components/MyDay";
import { getUserMinutes, loadDay, readEvening } from "@/features/day/lib/data";
import { dayPhase, timeline } from "@/features/day/lib/day";
import { plural } from "@/features/home/lib/format";
import type { Money } from "@/features/home/lib/queue";
import type { Workspace } from "@/lib/session";

export async function DayTop({ ws, today, fmt }: { ws: Workspace; today: string; fmt: Money }) {
	const [day, evening, now] = await Promise.all([
		loadDay(ws, today, fmt),
		readEvening(ws.id),
		getUserMinutes(),
	]);
	const phase = dayPhase(day.plan, now, evening.time);
	const waiting = day.queue.filter((q) => q.tone !== "info").length;
	const left = day.picks.filter((p) => !p.done).length;
	const times = timeline(day.queue, { time: evening.time, closed: phase === "closed" });

	return (
		<div className="space-y-6">
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
						day.plan?.plannedAt && `${day.picks.length - left}/${day.picks.length} of my day done`,
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
			{day.plan?.plannedAt && phase !== "closed" && (
				<MyDay day={today} picks={day.picks} timeline={times} now={now} />
			)}
			{(phase === "plan" || phase === "close") && (
				<DayKey href={phase === "plan" ? "/morning" : "/evening"} />
			)}
		</div>
	);
}

function Invite({
	href,
	eyebrow,
	title,
	note,
	evening = false,
}: {
	href: string;
	eyebrow: string;
	title: string;
	note: string;
	evening?: boolean;
}) {
	return (
		<Link
			href={href}
			prefetch
			aria-keyshortcuts="O"
			className={cn(
				"group flex items-center gap-4 rounded-group bg-[var(--group-bg)] px-[var(--group-px)] py-4 outline-none transition-colors hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-ring",
				evening && "theme-keizoku",
			)}
		>
			<div className="min-w-0 flex-1">
				<p className="text-xs font-medium tracking-wide text-primary uppercase">{eyebrow}</p>
				<p className="mt-0.5 text-base font-semibold">{title}</p>
				<p className="mt-0.5 text-sm text-muted-foreground">{note}</p>
			</div>
			<HugeiconsIcon
				icon={ArrowRight01Icon}
				aria-hidden
				className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
			/>
		</Link>
	);
}
