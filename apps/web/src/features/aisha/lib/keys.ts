// Finding queue and history rows on the page for the row keys. DOM only.

/** The row's main control (it opens the row); its row is `[data-aisha-row]`. */
export const ROW_SELECTOR = "[data-aisha-id]";

/** The row the keys act on: the one in focus, else the one under the pointer. */
export function targetRow(): HTMLElement | null {
	const focused = document.activeElement;
	if (focused instanceof HTMLElement) {
		const main = focused.closest("[data-aisha-row]")?.querySelector<HTMLElement>(ROW_SELECTOR);
		if (main) return main;
	}
	const hovered = document.querySelector("[data-aisha-row]:hover");
	return hovered?.querySelector<HTMLElement>(ROW_SELECTOR) ?? null;
}

/** The row above or below, in the page's order. */
export function neighbourRow(from: HTMLElement, down: boolean): HTMLElement | null {
	const all = [...document.querySelectorAll<HTMLElement>(ROW_SELECTOR)];
	const i = all.indexOf(from);
	return i < 0 ? null : (all[i + (down ? 1 : -1)] ?? null);
}

/** ↑/↓ between rows while one has focus. Returns true when it moved. */
export function moveRowFocus(e: KeyboardEvent): boolean {
	if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return false;
	if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return false;
	if (!(e.target instanceof HTMLElement) || !e.target.closest("[data-aisha-row]")) return false;
	const from = targetRow();
	const next = from && neighbourRow(from, e.key === "ArrowDown");
	if (!next) return false;
	next.focus();
	return true;
}
