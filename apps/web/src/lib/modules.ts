// What a workspace has switched on: each app, and each of the shell's own features. Stored as
// the ones switched off (`workspaces.hidden_apps`), so a module added later is on for everyone
// until they turn it off. Off means gone everywhere: navigation, Today, ⌘K, Capture, pushes, MCP.
// Pure.

import { APPS_CONFIG } from "@/lib/app-themes";

export type AppHref = keyof typeof APPS_CONFIG;

/** The shell's features beyond the apps. Today, Capture and Settings are always there. */
export const FEATURES = {
	"/day": {
		name: "Day",
		kanji: "日",
		pitch: "Plan the morning (pick up to three), close the evening (log it, sort what's left).",
	},
	"/week": {
		name: "Week",
		kanji: "週",
		pitch: "The week behind and ahead on one page, and a Sunday recap.",
	},
	"/week/plan": {
		name: "Week plan",
		kanji: "画",
		pitch: "Up to three things to focus on each week, planned on Sunday.",
		needs: "/week",
	},
	"/goals": {
		name: "Goals",
		kanji: "志",
		pitch: "Goals that link a fund, a project, a habit or a list, with their progress.",
	},
} as const satisfies Record<
	string,
	{ name: string; kanji: string; pitch: string; needs?: `/${string}` }
>;

export type FeatureHref = keyof typeof FEATURES;
export type ModuleHref = AppHref | FeatureHref;

export const APP_HREFS = Object.keys(APPS_CONFIG) as AppHref[];
export const FEATURE_HREFS = Object.keys(FEATURES) as FeatureHref[];
export const MODULE_HREFS: ModuleHref[] = [...APP_HREFS, ...FEATURE_HREFS];

export const isModule = (value: string): value is ModuleHref =>
	(MODULE_HREFS as string[]).includes(value);

/** What's on, from what was switched off. A feature whose base is off is off too. */
export function modulesOn(off: readonly string[]): ModuleHref[] {
	const on = new Set(MODULE_HREFS.filter((m) => !off.includes(m)));
	for (const href of FEATURE_HREFS) {
		const needs = (FEATURES[href] as { needs?: ModuleHref }).needs;
		if (needs && !on.has(needs)) on.delete(href);
	}
	return MODULE_HREFS.filter((m) => on.has(m));
}

/** The module a page belongs to: "/morning" is Day's, "/kuroji/x" is Kuroji's; none for the
 * pages that are always there (Today, Apps, Settings). */
export function moduleOfPath(pathname: string): ModuleHref | null {
	const path = pathname.split(/[?#]/)[0] ?? "";
	const under = (href: string) => path === href || path.startsWith(`${href}/`);
	if (under("/morning") || under("/evening")) return "/day";
	if (under("/week/plan")) return "/week/plan";
	if (under("/week")) return "/week";
	if (under("/goals")) return "/goals";
	return APP_HREFS.find(under) ?? null;
}

/** Whether a page is reachable with these modules on. */
export function pathIsOn(pathname: string, on: readonly ModuleHref[]): boolean {
	const module = moduleOfPath(pathname);
	return module === null || on.includes(module);
}

/** The module an MCP tool belongs to, by its name; none for `today`. */
export function moduleOfTool(name: string): ModuleHref | null {
	if (name === "today") return null;
	if (name === "week") return "/week";
	if (name === "goals") return "/goals";
	if (name.startsWith("week_")) return "/week/plan";
	if (name === "day" || name.startsWith("day_")) return "/day";
	const app = name.split("_")[0];
	return APP_HREFS.find((href) => href === `/${app}`) ?? null;
}
