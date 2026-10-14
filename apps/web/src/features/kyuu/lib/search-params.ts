import {
	type KyuuApplyMethod,
	type KyuuFilterStatus,
	kyuuApplyMethodValues,
	kyuuFilterStatusValues,
} from "./kyuu-schemas";

export interface RawKyuuSearchParams {
	status?: string;
	source?: string;
	method?: string;
	stage?: string;
	from?: string;
	to?: string;
	q?: string;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const STAGE_KEYS = ["hr", "tech", "offer"] as const;
type StageKey = (typeof STAGE_KEYS)[number];

export function parseKyuuFilters(raw: RawKyuuSearchParams) {
	const status = (kyuuFilterStatusValues as readonly string[]).includes(raw.status ?? "")
		? (raw.status as KyuuFilterStatus)
		: undefined;
	const method = (kyuuApplyMethodValues as readonly string[]).includes(raw.method ?? "")
		? (raw.method as KyuuApplyMethod)
		: undefined;
	const from = raw.from && ISO_DATE.test(raw.from) ? raw.from : undefined;
	const to = raw.to && ISO_DATE.test(raw.to) ? raw.to : undefined;
	const stages = raw.stage
		?.split(",")
		.filter((s): s is StageKey => (STAGE_KEYS as readonly string[]).includes(s));

	return {
		status,
		source: raw.source || undefined,
		method,
		stages: stages && stages.length > 0 ? stages : undefined,
		from,
		to,
		q: raw.q?.trim() || undefined,
	};
}

export function hasActiveKyuuFilters(f: ReturnType<typeof parseKyuuFilters>): boolean {
	return Boolean(f.status || f.source || f.method || f.stages || f.from || f.to || f.q);
}

// One page of the table. The page is resent after every inline edit, and on phones a few
// hundred rows made the first render and every re-render slow.
export const APPLICATIONS_PAGE_SIZE = 50;
