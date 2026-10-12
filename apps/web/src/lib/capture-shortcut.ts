// Single-key shortcuts ("N" opens capture, and the like). Pure rules; components read the DOM.

export type ShortcutKey = {
	key: string;
	/** The physical key; lets letters work on a Cyrillic layout too. */
	code?: string;
	ctrlKey: boolean;
	metaKey: boolean;
	altKey: boolean;
	shiftKey?: boolean;
};

/**
 * N opens capture only when nothing else wants the key: no modifier (Ctrl/Cmd/Alt+N belong to
 * the browser), no typing in a field, and no dialog, sheet or popover already open.
 */
export function shouldOpenCapture(e: ShortcutKey, context: ShortcutContext) {
	return plainKey(e, context) === "n";
}

export type ShortcutContext = { editableFocused: boolean; overlayOpen: boolean };

/** Punctuation shortcuts by physical key, unshifted. */
const CODE_KEYS: Record<string, string> = {
	BracketLeft: "[",
	BracketRight: "]",
	Comma: ",",
	Period: ".",
	Slash: "/",
};

/**
 * The key a shortcut is named by: a Latin letter as typed (so Dvorak's N is N), else the
 * letter, digit or bracket printed on that key in QWERTY (so "т" on a Russian layout is N).
 * Backspace and Delete both read "delete".
 */
export function shortcutKey(e: ShortcutKey): string | null {
	if (e.key === "?") return "?";
	if (e.key === "Backspace" || e.key === "Delete") return "delete";
	if (/^[a-z0-9]$/i.test(e.key)) return e.key.toLowerCase();
	const code = e.code ?? "";
	if (code === "Slash" && e.shiftKey) return "?";
	if (/^Key[A-Z]$/.test(code)) return code.slice(3).toLowerCase();
	if (!e.shiftKey && /^Digit\d$/.test(code)) return code.slice(5);
	if (!e.shiftKey && CODE_KEYS[code]) return CODE_KEYS[code];
	return e.key.length === 1 ? e.key.toLowerCase() : null;
}

/**
 * The shortcut key when a single-key shortcut may act on it (the same rule as N), else null.
 */
export function plainKey(e: ShortcutKey, context: ShortcutContext) {
	if (e.ctrlKey || e.metaKey || e.altKey) return null;
	if (context.editableFocused || context.overlayOpen) return null;
	return shortcutKey(e);
}

/** Radix dialogs, sheets, popovers, selects and menus, wherever they are portalled. */
export const OVERLAY_SELECTOR =
	'[role="dialog"], [role="alertdialog"], [role="listbox"], [role="menu"], [data-radix-popper-content-wrapper]';

export function isEditable(target: EventTarget | null) {
	if (!(target instanceof HTMLElement)) return false;
	return (
		target.isContentEditable ||
		target.tagName === "INPUT" ||
		target.tagName === "TEXTAREA" ||
		target.tagName === "SELECT"
	);
}

/** plainKey for a live keydown: reads focus and open overlays from the page. */
export function pageKey(e: KeyboardEvent) {
	return plainKey(e, {
		editableFocused: isEditable(e.target),
		overlayOpen: !!document.querySelector(OVERLAY_SELECTOR),
	});
}
