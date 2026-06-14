"use client";

import type { HeatmapDay } from "@/features/tsundoku/actions/sessions";
import { cn } from "@seikatsu/ui";
import { useMemo } from "react";

const WEEKS = 53;
const DAY_MS = 86_400_000;

function bucket(pages: number): string {
	if (pages === 0) return "bg-muted";
	if (pages <= 20) return "bg-primary/25";
	if (pages <= 50) return "bg-primary/50";
	if (pages <= 100) return "bg-primary/75";
	return "bg-primary";
}

function iso(d: Date): string {
	return d.toISOString().slice(0, 10);
}

export function ReadingHeatmap({ days }: { days: HeatmapDay[] }) {
	const { columns, total, activeDays } = useMemo(() => {
		const map = new Map(days.map((d) => [d.date, d.pages]));

		// End at today; align grid end to the upcoming Saturday so columns are whole weeks.
		const today = new Date();
		today.setHours(0, 0, 0, 0);
		const end = new Date(today.getTime() + (6 - today.getDay()) * DAY_MS);
		const start = new Date(end.getTime() - (WEEKS * 7 - 1) * DAY_MS);

		const cols: { date: string; pages: number; future: boolean }[][] = [];
		let cursor = new Date(start);
		for (let w = 0; w < WEEKS; w++) {
			const col: { date: string; pages: number; future: boolean }[] = [];
			for (let d = 0; d < 7; d++) {
				const key = iso(cursor);
				col.push({ date: key, pages: map.get(key) ?? 0, future: cursor > today });
				cursor = new Date(cursor.getTime() + DAY_MS);
			}
			cols.push(col);
		}

		const totalPages = days.reduce((s, d) => s + d.pages, 0);
		const active = days.filter((d) => d.pages > 0).length;
		return { columns: cols, total: totalPages, activeDays: active };
	}, [days]);

	return (
		<div className="space-y-2">
			<div className="flex items-center justify-between text-xs text-muted-foreground">
				<span>
					{activeDays} reading {activeDays === 1 ? "day" : "days"} · {total.toLocaleString()} pages
				</span>
				<span className="flex items-center gap-1">
					Less
					<span className="h-2.5 w-2.5 rounded-sm bg-muted" />
					<span className="h-2.5 w-2.5 rounded-sm bg-primary/25" />
					<span className="h-2.5 w-2.5 rounded-sm bg-primary/50" />
					<span className="h-2.5 w-2.5 rounded-sm bg-primary/75" />
					<span className="h-2.5 w-2.5 rounded-sm bg-primary" />
					More
				</span>
			</div>
			<div className="overflow-x-auto pb-1">
				<div className="flex gap-[3px]">
					{columns.map((col) => (
						<div key={col[0].date} className="flex flex-col gap-[3px]">
							{col.map((cell) => (
								<div
									key={cell.date}
									title={cell.future ? undefined : `${cell.date}: ${cell.pages} pages`}
									className={cn(
										"h-2.5 w-2.5 rounded-sm",
										cell.future ? "bg-transparent" : bucket(cell.pages),
									)}
								/>
							))}
						</div>
					))}
				</div>
			</div>
		</div>
	);
}
