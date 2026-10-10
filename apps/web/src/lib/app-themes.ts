// Fix 7: single source of truth for app paths, names, and themes
// AppSidebar imports APPS_CONFIG so path/name are never duplicated
export const APPS_CONFIG = {
	"/kuroji": {
		theme: "theme-kuroji",
		name: "Kuroji",
		label: "Finance",
		kanji: "黒",
		description:
			"Finance tracker. Double-entry accounting, multi-currency, recurring transactions.",
	},
	"/seiryu": {
		theme: "theme-seiryu",
		name: "Seiryu",
		label: "Projects",
		kanji: "清",
		description: "Kanban board. Projects, columns, cards, checklists, and labels.",
	},
	"/tsundoku": {
		theme: "theme-tsundoku",
		name: "Tsundoku",
		label: "Books",
		kanji: "積",
		description: "Books tracker. Library, reading progress, ratings, sessions, and stats.",
	},
	"/keizoku": {
		theme: "theme-keizoku",
		name: "Keizoku",
		label: "Habits",
		kanji: "継",
		description: "Habit tracker. Streaks, completion rate, and daily check-ins.",
	},
	"/kyuu": {
		theme: "theme-kyuu",
		name: "Kyuu",
		label: "Job Search",
		kanji: "求",
		description: "Job application tracker. Pipeline stages, sources, and status.",
	},
	"/aisha": {
		theme: "theme-aisha",
		name: "Aisha",
		label: "Car Care",
		kanji: "愛",
		description: "Car care. Maintenance schedule, mileage, service history, and documents.",
	},
} satisfies Record<
	string,
	{ theme: string; name: string; label: string; kanji: string; description: string }
>;

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
