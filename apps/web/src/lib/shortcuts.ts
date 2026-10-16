// Every app's keyboard shortcuts, as the "?" sheet lists them. The handlers live with their
// features; keep this in step when one is added.

export type Shortcut = { keys: string[]; label: string };
export type ShortcutGroup = { title: string; items: Shortcut[] };

/** Opens the shortcuts sheet (the "?" key, or the account menu). */
export const SHORTCUTS_EVENT = "seikatsu:shortcuts";

export const GENERAL_SHORTCUTS: ShortcutGroup = {
	title: "Anywhere",
	items: [
		{ keys: ["?"], label: "Show shortcuts" },
		{ keys: ["Esc"], label: "Close a dialog, sheet or menu" },
	],
};

/** By route prefix. */
export const APP_SHORTCUTS: Record<string, ShortcutGroup[]> = {
	"/kuroji": [
		{
			title: "Kuroji",
			items: [
				{ keys: ["N"], label: "New transaction" },
				{ keys: ["1"], label: "Expenses" },
				{ keys: ["2"], label: "Accounts" },
				{ keys: ["3"], label: "Transactions" },
				{ keys: ["/"], label: "Search transactions" },
				{ keys: [","], label: "Settings" },
			],
		},
	],
	"/tsundoku": [
		{
			title: "Tsundoku",
			items: [
				{ keys: ["N"], label: "Add book" },
				{ keys: ["/"], label: "Search the library" },
				{ keys: ["F"], label: "Filter the library" },
				{ keys: ["B"], label: "Library" },
				{ keys: ["Y"], label: "Year" },
				{ keys: [","], label: "Settings" },
			],
		},
		{
			title: "Book in focus, under the pointer, or open",
			items: [
				{ keys: ["←", "↑", "↓", "→"], label: "Move focus between books" },
				{ keys: ["Enter"], label: "Open" },
				{ keys: ["L"], label: "Update progress" },
				{ keys: ["1", "2", "3", "4", "5"], label: "Rate in stars" },
				{ keys: ["0"], label: "Clear the rating" },
				{ keys: ["P", "R", "D"], label: "Pile, Reading, Done" },
				{ keys: ["E"], label: "Edit details (book page)" },
				{ keys: ["Q"], label: "Add a quote (book page)" },
				{ keys: ["."], label: "Open its menu" },
				{ keys: ["⌫"], label: "Delete" },
			],
		},
	],
	"/keizoku": [
		{
			title: "Keizoku",
			items: [
				{ keys: ["N"], label: "New habit" },
				{ keys: ["T"], label: "Today" },
				{ keys: ["Y"], label: "Year" },
				{ keys: [","], label: "Settings" },
			],
		},
		{
			title: "Habit in focus, under the pointer, or open",
			items: [
				{ keys: ["↑", "↓"], label: "Move focus between habits" },
				{ keys: ["Enter"], label: "Open" },
				{ keys: ["X"], label: "Done today, or not" },
				{ keys: ["M"], label: "Today's note & photo" },
				{ keys: ["E"], label: "Edit" },
				{ keys: ["A"], label: "Archive (restore on an archived habit's page)" },
				{ keys: ["."], label: "Open its menu" },
				{ keys: ["⌫"], label: "Delete (habit page)" },
			],
		},
	],
	"/kyuu": [
		{
			title: "Kyuu",
			items: [
				{ keys: ["N"], label: "New application" },
				{ keys: ["1"], label: "Now" },
				{ keys: ["2"], label: "All" },
				{ keys: ["3"], label: "Stats" },
				{ keys: ["/"], label: "Search (All, Stats)" },
				{ keys: [","], label: "Settings" },
			],
		},
		{
			title: "Application in focus or under the pointer",
			items: [
				{ keys: ["↑", "↓"], label: "Move focus between applications" },
				{ keys: ["Enter"], label: "Open" },
				{ keys: ["O"], label: "Open the posting" },
				{ keys: ["E"], label: "Edit" },
				{ keys: ["X"], label: "Mark sent (to send)" },
				{ keys: ["S"], label: "Book a screening" },
				{ keys: ["I"], label: "Book an interview" },
				{ keys: ["F"], label: "Followed up (waiting)" },
				{ keys: ["G"], label: "No answer, close as ghosted (waiting)" },
				{ keys: ["R"], label: "Rejected" },
				{ keys: ["A"], label: "Archive or restore" },
				{ keys: ["."], label: "Open its menu" },
				{ keys: ["⌫"], label: "Delete" },
			],
		},
	],
	"/seiryu": [
		{
			title: "Board",
			items: [
				{ keys: ["N"], label: "New card" },
				{ keys: ["F"], label: "Filter" },
				{ keys: ["A"], label: "Archived cards" },
			],
		},
		{
			title: "Card in focus or under the pointer",
			items: [
				{ keys: ["←", "↑", "↓", "→"], label: "Move focus between cards" },
				{ keys: ["Enter"], label: "Open" },
				{ keys: ["Space"], label: "Pick up, then arrows to move, Space to drop" },
				{ keys: ["[", "]"], label: "Move to the previous or next column" },
				{ keys: ["1", "2", "3", "4"], label: "Priority: low to urgent" },
				{ keys: ["0"], label: "Clear priority" },
				{ keys: ["E"], label: "Archive" },
				{ keys: ["⌫"], label: "Delete" },
				{ keys: ["."], label: "Open its menu" },
			],
		},
	],
};

function appPrefix(pathname: string) {
	return Object.keys(APP_SHORTCUTS).find(
		(prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
	);
}

/** Whether this page's app has keys of its own (the header then shows the "?" button). */
export const hasAppShortcuts = (pathname: string) => !!appPrefix(pathname);

export function shortcutsFor(pathname: string): ShortcutGroup[] {
	const app = appPrefix(pathname);
	return [...(app ? (APP_SHORTCUTS[app] ?? []) : []), GENERAL_SHORTCUTS];
}
