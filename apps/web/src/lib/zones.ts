import type { APPS_CONFIG } from "@/lib/app-themes";

type AppHref = keyof typeof APPS_CONFIG;

/** Life areas: the apps grouped the way the day is lived, not the way they were built. Each
 * zone has its own page (`href`): what its apps wait on, then their tiles. */
export const ZONES = [
	{
		id: "money",
		href: "/money",
		name: "Money",
		kanji: "金",
		pitch: "What came in, what went out, and what you're saving for.",
		apps: ["/kuroji", "/hoshii"],
	},
	{
		id: "do",
		href: "/do",
		name: "Do",
		kanji: "行",
		pitch: "Cards, habits, applications and the car: everything due, in one list.",
		apps: ["/seiryu", "/keizoku", "/kyuu", "/aisha"],
	},
	{
		id: "life",
		href: "/life",
		name: "Life",
		kanji: "暮",
		pitch: "The slower things: what you're reading.",
		apps: ["/tsundoku"],
	},
] as const satisfies readonly {
	id: string;
	href: string;
	name: string;
	kanji: string;
	pitch: string;
	apps: readonly AppHref[];
}[];

export type Zone = (typeof ZONES)[number];
export type ZoneId = Zone["id"];

export function getZone(id: ZoneId): Zone {
	return ZONES.find((zone) => zone.id === id) as Zone;
}

export function getZoneForApp(href: string): Zone | null {
	return ZONES.find((zone) => (zone.apps as readonly string[]).includes(href)) ?? null;
}

const within = (pathname: string, prefix: string) =>
	pathname === prefix || pathname.startsWith(`${prefix}/`);

/** The zone a page belongs to: the zone's own page, or any page of one of its apps. */
export function getZoneForPath(pathname: string): Zone | null {
	return (
		ZONES.find(
			(zone) =>
				within(pathname, zone.href) ||
				(zone.apps as readonly string[]).some((app) => within(pathname, app)),
		) ?? null
	);
}
