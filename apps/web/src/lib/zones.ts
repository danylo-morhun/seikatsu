import type { APPS_CONFIG } from "@/lib/app-themes";

type AppHref = keyof typeof APPS_CONFIG;

/** Life areas: the apps grouped the way the day is lived, not the way they were built. */
export const ZONES = [
	{ id: "money", name: "Money", kanji: "金", apps: ["/kuroji", "/hoshii"] },
	{ id: "do", name: "Do", kanji: "行", apps: ["/seiryu", "/keizoku", "/kyuu", "/aisha"] },
	{ id: "life", name: "Life", kanji: "暮", apps: ["/tsundoku"] },
] as const satisfies readonly {
	id: string;
	name: string;
	kanji: string;
	apps: readonly AppHref[];
}[];

export type Zone = (typeof ZONES)[number];

export function getZoneForApp(href: string): Zone | null {
	return ZONES.find((zone) => (zone.apps as readonly string[]).includes(href)) ?? null;
}
