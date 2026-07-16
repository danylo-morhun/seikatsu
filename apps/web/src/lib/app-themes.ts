// Fix 7: single source of truth for app paths, names, and themes
// AppSidebar imports APPS_CONFIG so path/name are never duplicated
export const APPS_CONFIG = {
	"/kuroji": {
		theme: "theme-kuroji",
		name: "黒 Kuroji",
		kanji: "黒",
		description:
			"Finance tracker. Double-entry accounting, multi-currency, recurring transactions.",
	},
	"/seiryu": {
		theme: "theme-seiryu",
		name: "清 Seiryu",
		kanji: "清",
		description: "Kanban board. Projects, columns, cards, checklists, and labels.",
	},
	"/tsundoku": {
		theme: "theme-tsundoku",
		name: "積 Tsundoku",
		kanji: "積",
		description: "Books tracker. Library, reading progress, ratings, sessions, and stats.",
	},
} satisfies Record<string, { theme: string; name: string; kanji: string; description: string }>;

export const APP_THEMES = Object.fromEntries(
	Object.entries(APPS_CONFIG).map(([path, { theme }]) => [path, theme]),
) as Record<string, string>;

export function getAppForPath(pathname: string) {
	for (const [href, config] of Object.entries(APPS_CONFIG)) {
		if (pathname.startsWith(href)) return { ...config, href };
	}
	return null;
}

export function getThemeForPath(pathname: string): string {
	const direct = getAppForPath(pathname)?.theme;
	if (direct) return direct;
	for (const [href, { theme }] of Object.entries(APPS_CONFIG)) {
		if (pathname.startsWith(`/settings${href}`)) return theme;
	}
	return "";
}
