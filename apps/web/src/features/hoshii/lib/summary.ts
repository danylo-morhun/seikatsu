// A year of wants: what was bought, what was let go, and how often a want survived cooling. Pure.

import { daysBetween } from "@/features/hoshii/lib/dates";
import type { HoshiiState } from "@/features/hoshii/lib/queue";

export type SummaryItem = {
	state: HoshiiState;
	addedOn: string;
	keptOn: string | null;
	boughtOn: string | null;
	releasedOn: string | null;
	skippedCooling: boolean;
	/** In the base currency: what was paid (bought), what it cost (released). Null if unknown. */
	amount: number | null;
};

export type MonthRow = { month: number; bought: number; released: number };

export type YearSummary = {
	saved: number;
	released: number;
	spent: number;
	bought: number;
	/** Days from adding to buying, on average; null with nothing bought. */
	averageWait: number | null;
	/** Kept after cooling vs let go: decisions made this year. */
	kept: number;
	decided: number;
	skipped: number;
	months: MonthRow[];
};

const inYear = (iso: string | null, year: number): iso is string =>
	iso?.startsWith(`${year}-`) ?? false;

export function yearSummary(items: SummaryItem[], year: number): YearSummary {
	const months: MonthRow[] = Array.from({ length: 12 }, (_, month) => ({
		month,
		bought: 0,
		released: 0,
	}));
	const out: YearSummary = {
		saved: 0,
		released: 0,
		spent: 0,
		bought: 0,
		averageWait: null,
		kept: 0,
		decided: 0,
		skipped: 0,
		months,
	};
	const waits: number[] = [];
	for (const item of items) {
		const amount = item.amount ?? 0;
		if (item.state === "bought" && inYear(item.boughtOn, year)) {
			out.bought++;
			out.spent += amount;
			months[Number(item.boughtOn.slice(5, 7)) - 1].bought += amount;
			waits.push(daysBetween(item.addedOn, item.boughtOn));
		}
		if (item.state === "released" && inYear(item.releasedOn, year)) {
			out.released++;
			out.saved += amount;
			out.decided++;
			months[Number(item.releasedOn.slice(5, 7)) - 1].released += amount;
		}
		if (inYear(item.keptOn, year)) {
			if (item.skippedCooling) out.skipped++;
			else {
				out.kept++;
				out.decided++;
			}
		}
	}
	if (waits.length > 0) {
		out.averageWait = Math.round(waits.reduce((a, b) => a + b, 0) / waits.length);
	}
	return out;
}

/** Years with a purchase or a let-go, plus this one, newest first. */
export function summaryYears(items: SummaryItem[], thisYear: number): number[] {
	const years = new Set([thisYear]);
	for (const i of items) {
		for (const day of [i.boughtOn, i.releasedOn, i.keptOn]) {
			if (day) years.add(Number(day.slice(0, 4)));
		}
	}
	return [...years].filter((y) => y <= thisYear).sort((a, b) => b - a);
}
