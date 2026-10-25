// A year of the car: km driven and money spent, by month. Pure; callers pass the data.

import { type Reading, daysBetween } from "./due";

/**
 * The odometer on `iso`, drawn as a straight line between readings. Before the first
 * reading it reads the first, after the last the last: no guessing past what was logged.
 */
export function kmAt(readings: Reading[], iso: string): number | null {
	if (readings.length === 0) return null;
	const sorted = [...readings].sort((a, b) => daysBetween(b.date, a.date) || a.km - b.km);
	if (iso <= sorted[0].date) return sorted[0].km;
	const last = sorted[sorted.length - 1];
	if (iso >= last.date) return last.km;
	for (let i = 1; i < sorted.length; i++) {
		const b = sorted[i];
		if (iso > b.date) continue;
		const a = sorted[i - 1];
		const span = daysBetween(a.date, b.date);
		if (span === 0) return b.km;
		return Math.round(a.km + ((b.km - a.km) * daysBetween(a.date, iso)) / span);
	}
	return last.km;
}

const monthStart = (year: number, m: number) =>
	new Date(Date.UTC(year, m, 1)).toISOString().slice(0, 10);

export interface YearService {
	date: string;
	cost: string | null;
}

export interface CarYear {
	year: number;
	/** km driven in the year, as far as the readings tell. */
	driven: number;
	spent: number;
	services: number;
	months: { km: number; spent: number; services: number }[];
}

export function carYear(readings: Reading[], services: YearService[], year: number): CarYear {
	const months = Array.from({ length: 12 }, (_, m) => {
		const from = kmAt(readings, monthStart(year, m));
		const to = kmAt(readings, monthStart(year, m + 1));
		return { km: from != null && to != null ? Math.max(0, to - from) : 0, spent: 0, services: 0 };
	});
	for (const s of services) {
		if (Number(s.date.slice(0, 4)) !== year) continue;
		const month = months[Number(s.date.slice(5, 7)) - 1];
		month.services += 1;
		month.spent += s.cost != null ? Number(s.cost) : 0;
	}
	return {
		year,
		driven: months.reduce((n, m) => n + m.km, 0),
		spent: months.reduce((n, m) => n + m.spent, 0),
		services: months.reduce((n, m) => n + m.services, 0),
		months,
	};
}

/** Every year with a reading or a service, newest first, always including `thisYear`. */
export function carYears(dates: string[], thisYear: number): number[] {
	const years = new Set([thisYear, ...dates.map((d) => Number(d.slice(0, 4)))]);
	return [...years].filter((y) => y <= thisYear).sort((a, b) => b - a);
}
