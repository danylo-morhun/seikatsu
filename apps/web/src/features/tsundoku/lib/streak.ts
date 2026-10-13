// Reading streaks from the set of days with at least one session. Days are YYYY-MM-DD.

function shift(day: string, by: number): string {
	const d = new Date(`${day}T00:00:00Z`);
	d.setUTCDate(d.getUTCDate() + by);
	return d.toISOString().slice(0, 10);
}

export interface Streaks {
	current: number;
	longest: number;
}

/** A streak still counts until the end of today: if today has no session yet, it runs to yesterday. */
export function computeStreaks(days: Iterable<string>, today: string): Streaks {
	const set = new Set(days);
	let longest = 0;
	for (const day of set) {
		if (set.has(shift(day, -1))) continue;
		let length = 1;
		while (set.has(shift(day, length))) length++;
		longest = Math.max(longest, length);
	}

	let cursor = set.has(today) ? today : shift(today, -1);
	let current = 0;
	while (set.has(cursor)) {
		current++;
		cursor = shift(cursor, -1);
	}
	return { current, longest };
}

export function daysBetween(start: string, end: string): number {
	const ms = Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`);
	return Math.max(0, Math.round(ms / 86_400_000));
}

export { shift as shiftDay };
