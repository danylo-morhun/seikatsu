import {
	KYUU_VIEWS,
	type KyuuApplyMethod,
	type KyuuView,
	kyuuApplyMethodValues,
} from "./kyuu-schemas";

export interface RawKyuuSearchParams {
	view?: string;
	source?: string;
	method?: string;
	from?: string;
	to?: string;
	q?: string;
	sort?: string;
	dir?: string;
	page?: string;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
export const SORT_FIELDS = ["date", "company", "status"] as const;
export type SortField = (typeof SORT_FIELDS)[number];

export interface KyuuFilters {
	view: KyuuView;
	source?: string;
	method?: KyuuApplyMethod;
	from?: string;
	to?: string;
	q?: string;
}

export function parseKyuuFilters(raw: RawKyuuSearchParams): KyuuFilters {
	const view = (KYUU_VIEWS as readonly string[]).includes(raw.view ?? "")
		? (raw.view as KyuuView)
		: "all";
	const method = (kyuuApplyMethodValues as readonly string[]).includes(raw.method ?? "")
		? (raw.method as KyuuApplyMethod)
		: undefined;
	return {
		view,
		source: raw.source || undefined,
		method,
		from: raw.from && ISO_DATE.test(raw.from) ? raw.from : undefined,
		to: raw.to && ISO_DATE.test(raw.to) ? raw.to : undefined,
		q: raw.q?.trim() || undefined,
	};
}

export function parseKyuuSort(raw: RawKyuuSearchParams) {
	const sort: SortField = (SORT_FIELDS as readonly string[]).includes(raw.sort ?? "")
		? (raw.sort as SortField)
		: "date";
	const dir: "asc" | "desc" = raw.dir === "asc" ? "asc" : "desc";
	const page = raw.page && /^\d+$/.test(raw.page) ? Number.parseInt(raw.page, 10) : 0;
	return { sort, dir, page };
}

/** Narrowing filters beyond the view: the "Clear" chip and the empty state read it. */
export function hasActiveKyuuFilters(f: KyuuFilters): boolean {
	return Boolean(f.source || f.method || f.from || f.to || f.q);
}

/** Filter params carry between All and Stats; the view, sort and page stay on All. */
export const CARRY_PARAMS = ["source", "method", "from", "to", "q"] as const;

// One page of the table. The page is resent after every inline edit, and on phones a few
// hundred rows made the first render and every re-render slow.
export const APPLICATIONS_PAGE_SIZE = 50;
