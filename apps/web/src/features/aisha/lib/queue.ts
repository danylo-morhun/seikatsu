// What's next for the car: maintenance and paperwork in one line, most urgent first.

import { type DueStatus, compareUrgency } from "./due";

export interface Queued<T> {
	status: DueStatus;
	/** When it's due, as best known: a maintenance estimate, a document's expiry. */
	when: string | null;
	entry: T;
}

export interface Queue<T> {
	/** Overdue, then due within the warning window. */
	due: Queued<T>[];
	/** Everything with a known next date, soonest first. */
	later: Queued<T>[];
	/** Never done as far as Aisha knows. */
	unknown: Queued<T>[];
}

export function buildQueue<T>(entries: Queued<T>[]): Queue<T> {
	const sorted = [...entries].sort((a, b) =>
		compareUrgency(
			{ status: a.status, estimatedDate: a.when },
			{ status: b.status, estimatedDate: b.when },
		),
	);
	return {
		due: sorted.filter((e) => e.status === "overdue" || e.status === "soon"),
		later: sorted.filter((e) => e.status === "ok"),
		unknown: sorted.filter((e) => e.status === "unknown"),
	};
}
