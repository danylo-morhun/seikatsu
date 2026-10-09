import { buildPeriodLabel, parseLocal } from "@/features/kuroji/lib/dates";
import { endOfMonth, format, startOfMonth } from "date-fns";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export type KurojiPeriod = {
	from: string | undefined;
	to: string | undefined;
	isAllTime: boolean;
	/** The URL picked a range explicitly (not the default month, not all time). */
	hasDateFilter: boolean;
	label: string;
};

/** The header period picker's URL params (`from`, `to`, `all=1`) → the range pages query. */
export function resolvePeriod(
	params: { from?: string; to?: string; all?: string },
	today: string,
): KurojiPeriod {
	const isAllTime = params.all === "1";
	const rawFrom = params.from && ISO_DATE.test(params.from) ? params.from : undefined;
	const rawTo = params.to && ISO_DATE.test(params.to) ? params.to : undefined;
	const swapped = rawFrom && rawTo && rawFrom > rawTo;
	const now = parseLocal(today);
	const from = isAllTime
		? undefined
		: ((swapped ? rawTo : rawFrom) ?? format(startOfMonth(now), "yyyy-MM-dd"));
	const to = isAllTime
		? undefined
		: ((swapped ? rawFrom : rawTo) ?? format(endOfMonth(now), "yyyy-MM-dd"));

	return {
		from,
		to,
		isAllTime,
		hasDateFilter: !isAllTime && (rawFrom !== undefined || rawTo !== undefined),
		label: buildPeriodLabel(from, to, isAllTime),
	};
}

/** When asset/liability balances are measured: the period end, or "Now" once it reaches today. */
export function asOfLabel(to: string | undefined, today: string) {
	if (!to || to >= today) return "Now";
	return `As of ${format(parseLocal(to), "d MMM yyyy")}`;
}

/** Query string carrying the picked period to another Kuroji page, e.g. `?from=…&to=…`. */
export function periodQuery(params: URLSearchParams) {
	const qs = new URLSearchParams();
	if (params.get("all") === "1") qs.set("all", "1");
	for (const key of ["from", "to"]) {
		const value = params.get(key);
		if (value && !qs.has("all")) qs.set(key, value);
	}
	const s = qs.toString();
	return s ? `?${s}` : "";
}
