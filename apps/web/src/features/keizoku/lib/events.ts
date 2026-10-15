/** Fired by the header's and the bottom nav's New Habit buttons; the app's chrome opens capture. */
export const NEW_HABIT_EVENT = "keizoku:new-habit";

export function requestNewHabit() {
	window.dispatchEvent(new Event(NEW_HABIT_EVENT));
}
