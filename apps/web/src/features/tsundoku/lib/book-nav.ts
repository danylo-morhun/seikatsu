// Finding books on the page for the book keys. DOM only; the library and its keys use these.

export const BOOK_SELECTOR = "[data-book-id]";

/** The book the keys act on: the one in focus, else the one under the pointer. */
export function targetBook(): HTMLElement | null {
	const focused = document.activeElement;
	if (focused instanceof HTMLElement && focused.matches(BOOK_SELECTOR)) return focused;
	return document.querySelector<HTMLElement>(`${BOOK_SELECTOR}:hover`);
}

/**
 * The book an arrow key leads to: left and right walk the page's order, up and down go to the
 * nearest book in the row above or below (in a list, that's simply the previous or next).
 */
export function neighbourBook(from: HTMLElement, key: string): HTMLElement | null {
	const all = [...document.querySelectorAll<HTMLElement>(BOOK_SELECTOR)];
	const i = all.indexOf(from);
	if (i < 0) return null;
	if (key === "ArrowLeft") return all[i - 1] ?? null;
	if (key === "ArrowRight") return all[i + 1] ?? null;
	if (key !== "ArrowUp" && key !== "ArrowDown") return null;

	const here = from.getBoundingClientRect();
	const down = key === "ArrowDown";
	let best: HTMLElement | null = null;
	let bestScore = Number.POSITIVE_INFINITY;
	for (const el of all) {
		if (el === from) continue;
		const r = el.getBoundingClientRect();
		const dy = down ? r.top - here.bottom : here.top - r.bottom;
		if (dy < -2) continue;
		// The nearest row first, then the nearest column within it.
		const score = dy * 1000 + Math.abs(r.left - here.left);
		if (score < bestScore) {
			bestScore = score;
			best = el;
		}
	}
	return best;
}
