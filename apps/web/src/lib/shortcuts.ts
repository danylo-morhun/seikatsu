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
