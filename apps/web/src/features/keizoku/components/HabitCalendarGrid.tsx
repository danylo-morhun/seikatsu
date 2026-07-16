"use client";

import { getHabitLogs } from "@/features/keizoku/actions/logs";
import type { KeizokuHabitLog } from "@/features/keizoku/actions/logs";
import { localToday } from "@/features/keizoku/lib/dates";
import { ArrowLeft01Icon, ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { cn } from "@seikatsu/ui";
import { useEffect, useMemo, useState } from "react";

const DAY_INITIALS = ["S", "M", "T", "W", "T", "F", "S"];
const MONTH_NAMES = [
	"January",
	"February",
	"March",
	"April",
	"May",
	"June",
	"July",
	"August",
	"September",
	"October",
	"November",
	"December",
];

function pad(n: number): string {
	return String(n).padStart(2, "0");
}

function daysInMonth(year: number, month: number): number {
	return new Date(year, month + 1, 0).getDate();
}

interface Props {
	habitId: string;
	initialLogs: KeizokuHabitLog[];
	initialYear: number;
	initialMonth: number; // 0-indexed
}

export function HabitCalendarGrid({ habitId, initialLogs, initialYear, initialMonth }: Props) {
	const [year, setYear] = useState(initialYear);
	const [month, setMonth] = useState(initialMonth);
	const [logs, setLogs] = useState(initialLogs);
	const [loading, setLoading] = useState(false);

	useEffect(() => {
		if (year === initialYear && month === initialMonth) {
			setLogs(initialLogs);
			return;
		}
		let cancelled = false;
		setLoading(true);
		const from = `${year}-${pad(month + 1)}-01`;
		const to = `${year}-${pad(month + 1)}-${pad(daysInMonth(year, month))}`;
		getHabitLogs(habitId, from, to).then((l) => {
			if (!cancelled) {
				setLogs(l);
				setLoading(false);
			}
		});
		return () => {
			cancelled = true;
		};
	}, [year, month, habitId, initialYear, initialMonth, initialLogs]);

	const loggedDates = useMemo(() => new Set(logs.map((l) => l.date)), [logs]);
	const today = localToday();

	const firstDow = new Date(year, month, 1).getDay();
	const numDays = daysInMonth(year, month);
	const cells: (number | null)[] = [
		...Array(firstDow).fill(null),
		...Array.from({ length: numDays }, (_, i) => i + 1),
	];

	const isCurrentMonth = `${year}-${pad(month + 1)}` === today.slice(0, 7);

	function prevMonth() {
		if (month === 0) {
			setYear((y) => y - 1);
			setMonth(11);
		} else {
			setMonth((m) => m - 1);
		}
	}

	function nextMonth() {
		if (isCurrentMonth) return;
		if (month === 11) {
			setYear((y) => y + 1);
			setMonth(0);
		} else {
			setMonth((m) => m + 1);
		}
	}

	return (
		<div className="space-y-2">
			<div className="flex items-center justify-between">
				<button
					type="button"
					onClick={prevMonth}
					className="rounded p-1 text-muted-foreground transition-colors hover:text-foreground"
					aria-label="Previous month"
				>
					<HugeiconsIcon icon={ArrowLeft01Icon} className="h-4 w-4" />
				</button>
				<span className="text-sm font-medium">
					{MONTH_NAMES[month]} {year}
				</span>
				<button
					type="button"
					onClick={nextMonth}
					disabled={isCurrentMonth}
					className="rounded p-1 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30"
					aria-label="Next month"
				>
					<HugeiconsIcon icon={ArrowRight01Icon} className="h-4 w-4" />
				</button>
			</div>
			<div className="grid grid-cols-7 gap-1 text-center text-[10px] text-muted-foreground">
				{DAY_INITIALS.map((d, i) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: fixed 7-element weekday header, never reordered
					<span key={i}>{d}</span>
				))}
			</div>
			<div className={cn("grid grid-cols-7 gap-1", loading && "opacity-50")}>
				{cells.map((day, i) => {
					// biome-ignore lint/suspicious/noArrayIndexKey: leading blanks are a fixed-length prefix, never reordered
					if (day == null) return <div key={`empty-${i}`} />;
					const iso = `${year}-${pad(month + 1)}-${pad(day)}`;
					const done = loggedDates.has(iso);
					return (
						<div
							key={iso}
							title={iso}
							className={cn(
								"flex aspect-square items-center justify-center rounded-md text-xs",
								iso === today && "ring-1 ring-primary",
								done ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
							)}
						>
							{day}
						</div>
					);
				})}
			</div>
		</div>
	);
}
