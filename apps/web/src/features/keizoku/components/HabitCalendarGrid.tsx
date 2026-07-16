"use client";

import type { KeizokuHabitLog } from "@/features/keizoku/actions/logs";
import { GithubHeatmap, type HeatmapCell } from "@/features/keizoku/components/GithubHeatmap";
import { localToday } from "@/features/keizoku/lib/dates";
import { type HabitSchedule, addDays, isScheduled } from "@/features/keizoku/lib/streak";
import { useMemo } from "react";

const WEEKS = 53;

const LEGEND = [
	{ label: "Not scheduled", className: "bg-muted/20" },
	{ label: "Missed", className: "bg-muted" },
	{ label: "Done", className: "bg-primary" },
];

interface Props {
	habit: HabitSchedule;
	logs: KeizokuHabitLog[];
}

export function HabitCalendarGrid({ habit, logs }: Props) {
	const cellByDate = useMemo(() => {
		const loggedDates = new Set(logs.map((l) => l.date));
		const today = localToday();
		const start = addDays(today, -(WEEKS * 7 - 1));

		const map = new Map<string, HeatmapCell>();
		let cursor = start;
		while (cursor <= today) {
			const done = loggedDates.has(cursor);
			const scheduled = isScheduled(habit, cursor);
			map.set(cursor, {
				className: done ? "bg-primary" : scheduled ? "bg-muted" : "bg-muted/20",
				title: `${cursor}: ${done ? "done" : scheduled ? "missed" : "not scheduled"}`,
			});
			cursor = addDays(cursor, 1);
		}
		return map;
	}, [habit, logs]);

	const doneCount = logs.length;

	return (
		<GithubHeatmap
			weeks={WEEKS}
			cellByDate={cellByDate}
			emptyClassName="bg-muted/20"
			legend={LEGEND}
			summary={`${doneCount} logged ${doneCount === 1 ? "day" : "days"} in the last year`}
		/>
	);
}
