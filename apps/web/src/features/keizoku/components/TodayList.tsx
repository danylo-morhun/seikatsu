"use client";

import type { KeizokuHabit } from "@/features/keizoku/actions/habits";
import type { TodayHabit } from "@/features/keizoku/actions/logs";
import { AddHabitModal } from "@/features/keizoku/components/AddHabitModal";
import { ArchivedHabitsList } from "@/features/keizoku/components/ArchivedHabitsList";
import { HabitCard } from "@/features/keizoku/components/HabitCard";
import { TIME_OF_DAY_LABELS, TIME_OF_DAY_VALUES } from "@/features/keizoku/lib/constants";
import { localToday } from "@/features/keizoku/lib/dates";
import { Add01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@seikatsu/ui";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

interface Props {
	workspaceId: string;
	date: string;
	todayHabits: TodayHabit[];
	archivedHabits: KeizokuHabit[];
	/** Server-rendered activity heatmap (see KeizokuActivityHeatmap). */
	heatmap: React.ReactNode;
}

// Rendered on the server for the user's local day (see lib/timezone.ts). Mutations revalidate
// /keizoku, so fresh props arrive with each action response — no client refetch.
export function TodayList({ workspaceId, date, todayHabits, archivedHabits, heatmap }: Props) {
	const router = useRouter();

	// First visit before the tz cookie existed: the server guessed the day. If the browser's
	// day differs, store the zone (TimezoneSync may not have run yet) and re-render.
	useEffect(() => {
		if (localToday() === date) return;
		const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
		document.cookie = `tz=${encodeURIComponent(zone)}; path=/; max-age=31536000; samesite=lax`;
		router.refresh();
	}, [date, router]);

	const done = todayHabits.filter((t) => t.log != null).length;
	const total = todayHabits.length;

	const sections = TIME_OF_DAY_VALUES.map((timeOfDay) => ({
		timeOfDay,
		habits: todayHabits.filter((t) => t.habit.timeOfDay === timeOfDay),
	})).filter((s) => s.habits.length > 0);

	return (
		<div className="px-4 py-6 md:px-8">
			<div className="mb-5 flex items-center justify-between">
				<div>
					<h1 className="text-lg font-semibold">Today</h1>
					{total > 0 && (
						<p className="text-sm text-muted-foreground">
							{done}/{total} done
						</p>
					)}
				</div>
				<AddHabitModal
					workspaceId={workspaceId}
					trigger={
						<Button size="sm" className="gap-1.5">
							<HugeiconsIcon icon={Add01Icon} className="h-4 w-4" />
							Add habit
						</Button>
					}
				/>
			</div>

			{total === 0 ? (
				<div className="rounded-lg border border-dashed border-border/60 px-4 py-10 text-center">
					<p className="text-sm text-muted-foreground">No habits yet. Add one to start tracking.</p>
				</div>
			) : (
				<div className="flex flex-col gap-6">
					{sections.map(({ timeOfDay, habits }) => (
						<div key={timeOfDay}>
							<h2 className="mb-2 text-sm font-medium text-muted-foreground">
								{TIME_OF_DAY_LABELS[timeOfDay]}
							</h2>
							<div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-2">
								{habits.map(({ habit, log, streak }) => (
									<HabitCard key={habit.id} habit={habit} log={log} streak={streak} date={date} />
								))}
							</div>
						</div>
					))}
				</div>
			)}

			<div className="mt-6">{heatmap}</div>

			<ArchivedHabitsList habits={archivedHabits} />
		</div>
	);
}
