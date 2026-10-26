// Finding want rows on the page for the row keys. DOM only.

/** The row's main control (it opens the want); its row is `[data-hoshii-row]`. */
export const ROW_SELECTOR = "[data-hoshii-id]";

/** The row the keys act on: the one in focus, else the one under the pointer. */
export function targetRow(): HTMLElement | null {
	const focused = document.activeElement;
	if (focused instanceof HTMLElement) {
		const main = focused.closest("[data-hoshii-row]")?.querySelector<HTMLElement>(ROW_SELECTOR);
		if (main) return main;
	}
	const hovered = document.querySelector("[data-hoshii-row]:hover");
	return hovered?.querySelector<HTMLElement>(ROW_SELECTOR) ?? null;
}

/** ↑/↓ between rows while one has focus. Returns true when it moved. */
export function moveRowFocus(e: KeyboardEvent): boolean {
	if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return false;
	if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return false;
	if (!(e.target instanceof HTMLElement) || !e.target.closest("[data-hoshii-row]")) return false;
	const from = targetRow();
	const all = [...document.querySelectorAll<HTMLElement>(ROW_SELECTOR)];
	const i = from ? all.indexOf(from) : -1;
	const next = i < 0 ? null : all[i + (e.key === "ArrowDown" ? 1 : -1)];
	if (!next) return false;
	next.focus();
	return true;
}
