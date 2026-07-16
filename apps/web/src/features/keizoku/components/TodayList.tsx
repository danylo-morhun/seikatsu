"use client";

import { PageLoader } from "@/components/PageLoader";
import { getArchivedHabits } from "@/features/keizoku/actions/habits";
import type { KeizokuHabit } from "@/features/keizoku/actions/habits";
import { getTodayHabits } from "@/features/keizoku/actions/logs";
import type { TodayHabit } from "@/features/keizoku/actions/logs";
import { AddHabitModal } from "@/features/keizoku/components/AddHabitModal";
import { ArchivedHabitsList } from "@/features/keizoku/components/ArchivedHabitsList";
import { HabitLogRow } from "@/features/keizoku/components/HabitLogRow";
import { localToday } from "@/features/keizoku/lib/dates";
import { Add01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@seikatsu/ui";
import { useCallback, useEffect, useState } from "react";

interface Data {
	date: string;
	todayHabits: TodayHabit[];
	archivedHabits: KeizokuHabit[];
}

// "Today" is resolved client-side (localToday(), never toISOString()) so the day
// boundary matches the user's own timezone rather than the server's. Because this
// tree is client-only, router.refresh() is a no-op for it — mutations call refetch()
// (passed down as onChange) instead of relying on RSC re-render.
export function TodayList({ workspaceId }: { workspaceId: string }) {
	const [data, setData] = useState<Data | null>(null);

	const refetch = useCallback(() => {
		const date = localToday();
		return Promise.all([getTodayHabits(workspaceId, date), getArchivedHabits(workspaceId)]).then(
			([todayHabits, archivedHabits]) => {
				setData({ date, todayHabits, archivedHabits });
			},
		);
	}, [workspaceId]);

	useEffect(() => {
		refetch();
	}, [refetch]);

	if (!data) return <PageLoader />;

	const { date, todayHabits, archivedHabits } = data;
	const done = todayHabits.filter((t) => t.log != null).length;
	const total = todayHabits.length;

	return (
		<div className="mx-auto max-w-lg px-4 py-6">
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
					onChange={refetch}
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
				<div className="flex flex-col gap-2">
					{todayHabits.map(({ habit, log }) => (
						<HabitLogRow key={habit.id} habit={habit} log={log} date={date} onChange={refetch} />
					))}
				</div>
			)}

			<ArchivedHabitsList habits={archivedHabits} onChange={refetch} />
		</div>
	);
}
