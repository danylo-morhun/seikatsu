// The global "N" key that opens the capture dialog. Pure rule; the component reads the DOM.

export type ShortcutKey = {
	key: string;
	ctrlKey: boolean;
	metaKey: boolean;
	altKey: boolean;
};

/**
 * N opens capture only when nothing else wants the key: no modifier (Ctrl/Cmd/Alt+N belong to
 * the browser), no typing in a field, and no dialog, sheet or popover already open.
 */
export function shouldOpenCapture(e: ShortcutKey, context: ShortcutContext) {
	return plainKey(e, context) === "n";
}

export type ShortcutContext = { editableFocused: boolean; overlayOpen: boolean };

/**
 * The lower-cased key when a single-letter shortcut may act on it (the same rule as N), else
 * null.
 */
export function plainKey(e: ShortcutKey, context: ShortcutContext) {
	if (e.ctrlKey || e.metaKey || e.altKey) return null;
	if (context.editableFocused || context.overlayOpen) return null;
	return e.key.length === 1 ? e.key.toLowerCase() : null;
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
