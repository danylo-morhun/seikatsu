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
		pitch: "Where the money comes from and where it goes.",
		first: "Record a transaction",
	},
	"/seiryu": {
		theme: "theme-seiryu",
		name: "Seiryu",
		label: "Projects",
		kanji: "清",
		description: "Kanban board. Projects, columns, cards, checklists, and labels.",
		pitch: "A board per project, cards moved along as work gets done.",
		first: "Make a board",
	},
	"/tsundoku": {
		theme: "theme-tsundoku",
		name: "Tsundoku",
		label: "Books",
		kanji: "積",
		description: "Books tracker. Library, reading progress, ratings, sessions, and stats.",
		pitch: "The books to read, the one you're in, and what you thought.",
		first: "Add a book",
	},
	"/keizoku": {
		theme: "theme-keizoku",
		name: "Keizoku",
		label: "Habits",
		kanji: "継",
		description: "Habit tracker. Streaks, completion rate, and daily check-ins.",
		pitch: "Habits kept a day at a time, forgotten days filled in.",
		first: "Pick habits",
	},
	"/kyuu": {
		theme: "theme-kyuu",
		name: "Kyuu",
		label: "Job Search",
		kanji: "求",
		description: "Job application tracker. Pipeline stages, sources, and status.",
		pitch: "Every job application, from first look to the answer.",
		first: "Add an application",
	},
	"/aisha": {
		theme: "theme-aisha",
		name: "Aisha",
		label: "Car Care",
		kanji: "愛",
		description: "Car care. Maintenance schedule, mileage, service history, and documents.",
		pitch: "The car's service plan, mileage and papers: what's due next.",
		first: "Add your car",
	},
	"/hoshii": {
		theme: "theme-hoshii",
		name: "Hoshii",
		label: "Wants",
		kanji: "欲",
		description: "Wishlist. Wants cool down first; the keepers are ranked and saved for in order.",
		pitch: "What you want to buy, given time to cool, then saved for in order.",
		first: "Add a want",
	},
} satisfies Record<
	string,
	{
		theme: string;
		name: string;
		label: string;
		kanji: string;
		description: string;
		/** What the app is for, in a line, for someone who has never opened it. */
		pitch: string;
		/** The first thing its welcome asks for. */
		first: string;
	}
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
