// How far a goal has come, read from what it gathers. Pure — the page loads each link's
// reading from its app (./data) and hands them in.

import type { APPS_CONFIG } from "@/lib/app-themes";

type AppHref = keyof typeof APPS_CONFIG;

export const LINK_KINDS = ["fund", "project", "habit", "list", "shelf", "jobs"] as const;
export type LinkKind = (typeof LINK_KINDS)[number];

/** Which app each kind of link lives in, and what it's called there. */
export const LINK_APPS: Record<LinkKind, { app: AppHref; label: string }> = {
	fund: { app: "/kuroji", label: "Fund" },
	project: { app: "/seiryu", label: "Project" },
	habit: { app: "/keizoku", label: "Habit" },
	list: { app: "/hoshii", label: "Wish list" },
	shelf: { app: "/tsundoku", label: "Shelf" },
	jobs: { app: "/kyuu", label: "Job search" },
};

/** One linked container as its app sees it today. "missing": deleted or no longer owned. */
export type LinkReading =
	| { kind: "fund"; name: string; balance: number; currency: string; target: number | null }
	| { kind: "project"; name: string; done: number; total: number; projectId: string }
	| { kind: "habit"; name: string; emoji: string; done: number; expected: number }
	| { kind: "list"; name: string; cooling: number; planned: number; bought: number }
	| { kind: "shelf"; name: string; finished: number; total: number }
	| { kind: "jobs"; sent: number; answered: number; active: number }
	| { kind: "missing"; was: LinkKind };

export type LinkView = {
	app: AppHref;
	href: string;
	title: string;
	detail: string;
	/** 0–1 when the link has a finish line; null when it only counts. */
	ratio: number | null;
};

/** Over the last four weeks: how often a habit was kept. */
export const HABIT_DAYS = 28;
/** Kyuu counts the last month. */
export const JOB_DAYS = 30;

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
const clamp = (n: number) => Math.max(0, Math.min(1, n));

export function describeLink(r: LinkReading, money: (n: number, c: string) => string): LinkView {
	switch (r.kind) {
		case "fund":
			return {
				app: "/kuroji",
				href: "/kuroji?tab=plan",
				title: r.name,
				detail: r.target
					? `${money(r.balance, r.currency)} of ${money(r.target, r.currency)}`
					: `${money(r.balance, r.currency)} saved`,
				ratio: r.target ? clamp(r.balance / r.target) : null,
			};
		case "project":
			return {
				app: "/seiryu",
				href: `/seiryu/${r.projectId}`,
				title: r.name,
				detail: r.total > 0 ? `${r.done} of ${plural(r.total, "card")} done` : "No cards yet",
				ratio: r.total > 0 ? r.done / r.total : null,
			};
		case "habit":
			return {
				app: "/keizoku",
				href: "/keizoku",
				title: `${r.emoji} ${r.name}`.trim(),
				detail:
					r.expected > 0
						? `${Math.round(clamp(r.done / r.expected) * 100)}% over 4 weeks`
						: `${plural(r.done, "time")} in 4 weeks`,
				ratio: r.expected > 0 ? clamp(r.done / r.expected) : null,
			};
		case "list":
			return {
				app: "/hoshii",
				href: "/hoshii/lists",
				title: r.name,
				detail:
					[
						r.bought > 0 && `${r.bought} bought`,
						r.planned > 0 && `${r.planned} in the Plan`,
						r.cooling > 0 && `${r.cooling} cooling`,
					]
						.filter(Boolean)
						.join(" · ") || "Nothing on it yet",
				ratio: r.bought + r.planned > 0 ? r.bought / (r.bought + r.planned) : null,
			};
		case "shelf":
			return {
				app: "/tsundoku",
				href: "/tsundoku",
				title: r.name,
				detail: r.total > 0 ? `${r.finished} of ${plural(r.total, "book")} read` : "No books yet",
				ratio: r.total > 0 ? r.finished / r.total : null,
			};
		case "jobs":
			return {
				app: "/kyuu",
				href: "/kyuu",
				title: "Job search",
				detail: `${r.sent} sent · ${r.answered} answered in 30 days · ${r.active} active`,
				ratio: null,
			};
		case "missing":
			return {
				app: LINK_APPS[r.was].app,
				href: LINK_APPS[r.was].app,
				title: `${LINK_APPS[r.was].label} no longer there`,
				detail: "Deleted in its app; unlink it",
				ratio: null,
			};
	}
}

/** The goal's progress: the mean of its links that have a finish line; null if none do. */
export function goalProgress(views: LinkView[]): number | null {
	const ratios = views.flatMap((v) => (v.ratio == null ? [] : [v.ratio]));
	return ratios.length > 0 ? ratios.reduce((a, b) => a + b, 0) / ratios.length : null;
}

const DAY_MS = 86_400_000;

/** "in 3 months", "in 12 days", "today", "5 days over". */
export function timeLeft(targetDate: string, today: string): string {
	const days = Math.round((Date.parse(targetDate) - Date.parse(today)) / DAY_MS);
	if (days === 0) return "today";
	if (days < 0) return `${plural(-days, "day")} over`;
	if (days < 45) return `in ${plural(days, "day")}`;
	if (days < 365) return `in ${plural(Math.round(days / 30), "month")}`;
	return `in ${plural(Math.round(days / 365), "year")}`;
}
