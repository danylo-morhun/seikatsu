import type { Reading } from "./due";

/**
 * The odometer only goes up. Returns why `next` doesn't fit between existing
 * readings, or null if it does.
 */
export function readingConflict(readings: Reading[], next: Reading): string | null {
	const earlier = readings.filter((r) => r.date <= next.date).map((r) => r.km);
	const earlierMax = Math.max(0, ...earlier);
	if (next.km < earlierMax) {
		return `Mileage can't go down: you already logged ${earlierMax} km on or before ${next.date}.`;
	}
	const later = readings.filter((r) => r.date > next.date).map((r) => r.km);
	if (later.length && next.km > Math.min(...later)) {
		return `A later reading has only ${Math.min(...later)} km.`;
	}
	return null;
}

export function currentKm(readings: Reading[]): number {
	return Math.max(0, ...readings.map((r) => r.km));
}
