// Fired by the header, the bottom nav, the welcome and the share link; Hoshii's chrome opens the dialog.

export const ADD_EVENT = "hoshii:add";

/** Add a want, optionally from a shop link (read at once). */
export function requestAdd(url?: string) {
	window.dispatchEvent(new CustomEvent(ADD_EVENT, { detail: { url } }));
}
