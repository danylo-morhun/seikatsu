// First-run setup (/welcome): which apps and features a new user keeps. Pure.

import {
	APP_HREFS,
	type AppHref,
	FEATURE_HREFS,
	type FeatureHref,
	MODULE_HREFS,
	type ModuleHref,
	modulesOn,
} from "@/lib/modules";

/** A light start: the week's recap, without the daily and weekly planning. */
export const DEFAULT_FEATURES: FeatureHref[] = ["/week"];

/** What's switched off for a choice: everything not picked. */
export function offFor(apps: readonly AppHref[], features: readonly FeatureHref[]): ModuleHref[] {
	const kept = new Set<ModuleHref>([...apps, ...features]);
	return MODULE_HREFS.filter((m) => !kept.has(m));
}

/** The choice to start from: what's on now when setting up again, else no apps and the defaults. */
export function startingChoice(off: readonly string[] | null): {
	apps: AppHref[];
	features: FeatureHref[];
} {
	if (!off) return { apps: [], features: DEFAULT_FEATURES };
	const on = modulesOn(off);
	return {
		apps: APP_HREFS.filter((h) => on.includes(h)),
		features: FEATURE_HREFS.filter((h) => on.includes(h)),
	};
}

/** Which details the last step asks for; none, and the setup ends a step early. */
export function detailsFor(
	apps: readonly AppHref[],
	canSetCurrency: boolean,
	/** No boards yet: a first one is offered. */
	noBoards = true,
): { currency: boolean; board: boolean } {
	return {
		currency: canSetCurrency && apps.includes("/kuroji"),
		board: noBoards && apps.includes("/seiryu"),
	};
}
