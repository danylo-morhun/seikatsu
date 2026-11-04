// Every place the user can go: the shell's pages, each app and its sections, settings. One
// list for the header's tabs and for ⌘K's "go to", so a section added to an app is reachable
// both ways. Pure.

import { APPS_CONFIG } from "@/lib/app-themes";

export const TSUNDOKU_TABS = [
	{ value: "/tsundoku", label: "Library" },
	{ value: "/tsundoku/year", label: "Year" },
] as const;

export const KEIZOKU_TABS = [
	{ value: "/keizoku", label: "Today" },
	{ value: "/keizoku/year", label: "Year" },
	{ value: "/keizoku/archive", label: "Archive" },
] as const;

export const KYUU_TABS = [
	{ value: "/kyuu", label: "Applications" },
	{ value: "/kyuu/stats", label: "Stats" },
] as const;

export const AISHA_TABS = [
	{ value: "/aisha", label: "Next" },
	{ value: "/aisha/history", label: "History" },
	{ value: "/aisha/year", label: "Year" },
] as const;

export const HOSHII_TABS = [
	{ value: "/hoshii", label: "Now" },
	{ value: "/hoshii/lists", label: "Lists" },
	{ value: "/hoshii/year", label: "Year" },
] as const;

const KUROJI_PLACES = [
	{ href: "/kuroji?tab=accounts", label: "Accounts" },
	{ href: "/kuroji?tab=transactions", label: "Transactions" },
	{ href: "/kuroji?tab=plan", label: "Plan" },
];

export type Place = {
	href: string;
	/** What it's called: "Kuroji", "Kuroji · Plan", "Week". */
	name: string;
	/** The app it belongs to, for its seal; none for the shell's pages. */
	app?: keyof typeof APPS_CONFIG;
};

const sectionsOf: Record<string, readonly { value: string; label: string }[]> = {
	"/tsundoku": TSUNDOKU_TABS,
	"/keizoku": KEIZOKU_TABS,
	"/kyuu": KYUU_TABS,
	"/aisha": AISHA_TABS,
	"/hoshii": HOSHII_TABS,
};

export const PLACES: Place[] = [
	{ href: "/", name: "Today" },
	{ href: "/week", name: "Week" },
	{ href: "/goals", name: "Goals" },
	{ href: "/apps", name: "Apps" },
	{ href: "/settings", name: "Settings" },
	...(
		Object.entries(APPS_CONFIG) as [
			keyof typeof APPS_CONFIG,
			(typeof APPS_CONFIG)[keyof typeof APPS_CONFIG],
		][]
	).flatMap(([href, app]) => [
		{ href, name: app.name, app: href },
		...(href === "/kuroji"
			? KUROJI_PLACES.map((p) => ({ href: p.href, name: `${app.name} · ${p.label}`, app: href }))
			: (sectionsOf[href] ?? [])
					.filter((t) => t.value !== href)
					.map((t) => ({ href: t.value, name: `${app.name} · ${t.label}`, app: href }))),
		{ href: `/settings${href}`, name: `${app.name} · Settings`, app: href },
	]),
];

/**
 * Places a line could mean, best first: a name that starts with it, then one with a word that
 * does ("plan" → Kuroji · Plan). Only short lines with no digits are places; anything else is
 * a capture.
 */
export function matchPlaces(text: string, limit = 5): Place[] {
	const q = text.trim().toLowerCase();
	if (q.length < 2 || q.length > 30 || /\d/.test(q)) return [];
	const words = (p: Place) =>
		p.name
			.toLowerCase()
			.split(/[\s·]+/)
			.filter(Boolean);
	const starts = PLACES.filter((p) => p.name.toLowerCase().startsWith(q));
	const inside = PLACES.filter((p) => !starts.includes(p) && words(p).some((w) => w.startsWith(q)));
	return [...starts, ...inside].slice(0, limit);
}
