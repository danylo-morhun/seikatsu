"use client";

import { cn } from "@seikatsu/ui";
import { useMemo } from "react";

function addDays(d: Date, n: number): Date {
	const copy = new Date(d);
	copy.setDate(copy.getDate() + n);
	return copy;
}

const MONTH_NAMES = [
	"Jan",
	"Feb",
	"Mar",
	"Apr",
	"May",
	"Jun",
	"Jul",
	"Aug",
	"Sep",
	"Oct",
	"Nov",
	"Dec",
];
// Sun..Sat rows — GitHub only labels every other row.
const WEEKDAY_LABELS = ["", "Mon", "", "Wed", "", "Fri", ""];

function iso(d: Date): string {
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export interface HeatmapCell {
	className: string;
	title?: string;
}

export interface LegendItem {
	label: string;
	className: string;
}

interface Props {
	weeks?: number;
	cellByDate: Map<string, HeatmapCell>;
	emptyClassName: string;
	legend: LegendItem[];
	summary?: React.ReactNode;
}

export function GithubHeatmap({ weeks = 53, cellByDate, emptyClassName, legend, summary }: Props) {
	const columns = useMemo(() => {
		const today = new Date();
		today.setHours(0, 0, 0, 0);
		// Align grid end to the upcoming Saturday so columns are whole weeks.
		const end = addDays(today, 6 - today.getDay());
		const start = addDays(end, -(weeks * 7 - 1));

		const cols: { date: string; future: boolean }[][] = [];
		let cursor = new Date(start);
		for (let w = 0; w < weeks; w++) {
			const col: { date: string; future: boolean }[] = [];
			for (let d = 0; d < 7; d++) {
				col.push({ date: iso(cursor), future: cursor > today });
				cursor = addDays(cursor, 1);
			}
			cols.push(col);
		}
		return cols;
	}, [weeks]);

	let lastMonth = -1;
	const monthLabels = columns.map((col) => {
		const month = Number(col[0].date.slice(5, 7)) - 1;
		if (month !== lastMonth) {
			lastMonth = month;
			return MONTH_NAMES[month];
		}
		return null;
	});

	return (
		<div className="space-y-1.5">
			{summary && <div className="text-xs text-muted-foreground">{summary}</div>}
			<div className="overflow-x-auto pb-1">
				<div className="flex gap-1">
					<div className="flex flex-col justify-between gap-[3px] pt-[15px] text-[10px] text-muted-foreground">
						{WEEKDAY_LABELS.map((label, i) => (
							// biome-ignore lint/suspicious/noArrayIndexKey: fixed 7-row weekday labels, never reordered
							<span key={i} className="h-2.5 leading-[10px]">
								{label}
							</span>
						))}
					</div>
					<div className="flex flex-col gap-[3px]">
						<div className="flex h-3 gap-[3px] text-[10px] leading-3 text-muted-foreground">
							{columns.map((col, i) => (
								<span key={col[0].date} className="relative w-2.5">
									{monthLabels[i] && (
										<span className="absolute left-0 whitespace-nowrap">{monthLabels[i]}</span>
									)}
								</span>
							))}
						</div>
						<div className="flex gap-[3px]">
							{columns.map((col) => (
								<div key={col[0].date} className="flex flex-col gap-[3px]">
									{col.map((day) => {
										const cell = cellByDate.get(day.date);
										return (
											<div
												key={day.date}
												title={day.future ? undefined : (cell?.title ?? day.date)}
												className={cn(
													"h-2.5 w-2.5 rounded-[3px]",
													day.future ? "bg-transparent" : (cell?.className ?? emptyClassName),
												)}
											/>
										);
									})}
								</div>
							))}
						</div>
						<div className="flex items-center justify-end gap-1 pt-1 text-xs text-muted-foreground">
							Less
							{legend.map((l) => (
								<span
									key={l.label}
									title={l.label}
									className={cn("h-2.5 w-2.5 rounded-[3px]", l.className)}
								/>
							))}
							More
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
