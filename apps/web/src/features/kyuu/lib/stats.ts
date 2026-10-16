// Kyuu's numbers, from applications and their events. Pure; the stats page loads the rows.

import {
	ANSWER_KINDS,
	CLOSED,
	type EventKind,
	PRE_APPLICATION,
	type Status,
	addDays,
	daysBetween,
	waiting,
} from "./stages";

export interface StatApp {
	id: string;
	status: Status;
	source: string | null;
	applyMethod: "manual" | "auto";
	dateApplied: string;
}

export interface StatEvent {
	applicationId: string;
	kind: EventKind;
	date: string | null;
}

export interface Rate {
	sent: number;
	answered: number;
	/** answered / sent, 0–1; null with nothing sent. */
	rate: number | null;
}

export interface KyuuStats {
	sent: number;
	answered: number;
	interviewed: number;
	offers: number;
	inProgress: number;
	waiting: number;
	closed: { rejected: number; withdrawn: number; ghosted: number };
	replyRate: number | null;
	interviewRate: number | null;
	/** Reached at least this far, in order. */
	funnel: { label: string; count: number }[];
	/** Where the closed ones stopped. */
	stops: { label: string; count: number }[];
	sources: (Rate & { source: string })[];
	methods: { auto: Rate; manual: Rate };
	/** Median days from sending to the first answer, over answers with a known day. */
	firstAnswer: { median: number; n: number } | null;
	/** Applications sent per week (Monday), every week from the first to the last. */
	weekly: { week: string; count: number }[];
}

const rate = (part: number, whole: number) => (whole > 0 ? part / whole : null);

function mondayOf(date: string): string {
	const day = new Date(`${date}T00:00:00Z`).getUTCDay(); // 0 = Sunday
	return addDays(date, -((day + 6) % 7));
}

function median(values: number[]): number {
	const sorted = [...values].sort((a, b) => a - b);
	const mid = Math.floor(sorted.length / 2);
	return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function computeStats(apps: StatApp[], events: StatEvent[], today: string): KyuuStats {
	const byApp = new Map<string, StatEvent[]>();
	for (const e of events) {
		const list = byApp.get(e.applicationId);
		if (list) list.push(e);
		else byApp.set(e.applicationId, [e]);
	}

	const sentApps = apps.filter((a) => !PRE_APPLICATION.includes(a.status));
	let answered = 0;
	let screened = 0;
	let interviewed = 0;
	let offers = 0;
	let inProgress = 0;
	let waitingCount = 0;
	const closed = { rejected: 0, withdrawn: 0, ghosted: 0 };
	const stops = { none: 0, screening: 0, interview: 0, offer: 0 };
	const sources = new Map<string, { sent: number; answered: number }>();
	const methods = { auto: { sent: 0, answered: 0 }, manual: { sent: 0, answered: 0 } };
	const answerDays: number[] = [];
	const weeks = new Map<string, number>();

	for (const app of sentApps) {
		const evs = byApp.get(app.id) ?? [];
		const has = (kind: EventKind) => evs.some((e) => e.kind === kind);
		// The status counts too: rows moved on before events existed, or by hand without one.
		const reachedOffer = has("offer") || app.status === "offer";
		const reachedInterview =
			reachedOffer || has("interview") || app.status === "technical_interview";
		const reachedScreen = reachedInterview || has("screening") || app.status === "hr_screening";
		const isAnswered = reachedScreen || has("rejected") || app.status === "rejected";

		if (isAnswered) answered++;
		if (reachedScreen) screened++;
		if (reachedInterview) interviewed++;
		if (reachedOffer) offers++;
		if (
			app.status === "hr_screening" ||
			app.status === "technical_interview" ||
			app.status === "offer"
		)
			inProgress++;

		if (CLOSED.includes(app.status)) {
			closed[app.status as keyof typeof closed]++;
			const at = reachedOffer
				? "offer"
				: reachedInterview
					? "interview"
					: reachedScreen
						? "screening"
						: "none";
			stops[at]++;
		}

		const lastFollowUp = evs
			.filter((e) => e.kind === "follow_up" && e.date)
			.reduce<string | null>((max, e) => (max && max > (e.date as string) ? max : e.date), null);
		if (waiting({ ...app, followedUpOn: lastFollowUp, answered: isAnswered }, today))
			waitingCount++;

		const src = sources.get(app.source ?? "Unknown") ?? { sent: 0, answered: 0 };
		src.sent++;
		if (isAnswered) src.answered++;
		sources.set(app.source ?? "Unknown", src);

		methods[app.applyMethod].sent++;
		if (isAnswered) methods[app.applyMethod].answered++;

		const firstAnswer = evs
			.filter((e) => ANSWER_KINDS.includes(e.kind) && e.date)
			.reduce<string | null>((min, e) => (min && min < (e.date as string) ? min : e.date), null);
		if (firstAnswer) {
			const days = daysBetween(app.dateApplied, firstAnswer);
			if (days >= 0) answerDays.push(days);
		}

		const week = mondayOf(app.dateApplied);
		weeks.set(week, (weeks.get(week) ?? 0) + 1);
	}

	const weekly: KyuuStats["weekly"] = [];
	const firstWeek = [...weeks.keys()].sort()[0];
	if (firstWeek) {
		const lastWeek = [...weeks.keys()].sort().at(-1) as string;
		for (let w = firstWeek; w <= lastWeek; w = addDays(w, 7))
			weekly.push({ week: w, count: weeks.get(w) ?? 0 });
	}

	const sent = sentApps.length;
	const toRate = (r: { sent: number; answered: number }): Rate => ({
		...r,
		rate: rate(r.answered, r.sent),
	});

	return {
		sent,
		answered,
		interviewed,
		offers,
		inProgress,
		waiting: waitingCount,
		closed,
		replyRate: rate(answered, sent),
		interviewRate: rate(interviewed, sent),
		funnel: [
			{ label: "Sent", count: sent },
			{ label: "Answered", count: answered },
			{ label: "Screening", count: screened },
			{ label: "Interview", count: interviewed },
			{ label: "Offer", count: offers },
		],
		stops: [
			{ label: "Before any answer", count: stops.none },
			{ label: "After a screening", count: stops.screening },
			{ label: "After an interview", count: stops.interview },
			{ label: "After an offer", count: stops.offer },
		],
		sources: [...sources.entries()]
			.map(([source, r]) => ({ source, ...toRate(r) }))
			.sort((a, b) => b.sent - a.sent),
		methods: { auto: toRate(methods.auto), manual: toRate(methods.manual) },
		firstAnswer:
			answerDays.length > 0 ? { median: median(answerDays), n: answerDays.length } : null,
		weekly,
	};
}
