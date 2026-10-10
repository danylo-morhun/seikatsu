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
export function shouldOpenCapture(
	e: ShortcutKey,
	context: { editableFocused: boolean; overlayOpen: boolean },
) {
	if (e.key !== "n" && e.key !== "N") return false;
	if (e.ctrlKey || e.metaKey || e.altKey) return false;
	return !context.editableFocused && !context.overlayOpen;
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
