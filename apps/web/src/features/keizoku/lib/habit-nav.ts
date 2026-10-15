// Finding habits on the page for the habit keys. DOM only.

export const HABIT_SELECTOR = "[data-habit-id]";

/** The habit the keys act on: the one in focus, else the one under the pointer. */
export function targetHabit(): HTMLElement | null {
	const focused = document.activeElement;
	if (focused instanceof HTMLElement) {
		const row = focused.closest<HTMLElement>("[data-habit-row]");
		const link = row?.querySelector<HTMLElement>(HABIT_SELECTOR);
		if (link) return link;
	}
	const hovered = document.querySelector<HTMLElement>("[data-habit-row]:hover");
	return hovered?.querySelector<HTMLElement>(HABIT_SELECTOR) ?? null;
}

/** The habit above or below, in the page's order. */
export function neighbourHabit(from: HTMLElement, down: boolean): HTMLElement | null {
	const all = [...document.querySelectorAll<HTMLElement>(HABIT_SELECTOR)];
	const i = all.indexOf(from);
	return i < 0 ? null : (all[i + (down ? 1 : -1)] ?? null);
}

// Habits just created: their row drops in once when Today shows it.
const fresh = new Set<string>();

export function markFresh(habitId: string) {
	fresh.add(habitId);
}

/** True the first time a fresh habit is rendered, then never again. */
export function takeFresh(habitId: string): boolean {
	return fresh.delete(habitId);
}
