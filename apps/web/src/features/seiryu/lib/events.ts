/** Fired by the header's and the bottom nav's New Card buttons; the board opens capture. */
export const NEW_CARD_EVENT = "seiryu:new-card";

export function requestNewCard() {
	window.dispatchEvent(new Event(NEW_CARD_EVENT));
}

/** The phone's Archive tab on a board: the board opens its archive sheet, as A does. */
export const OPEN_ARCHIVE_EVENT = "seiryu:open-archive";

export function requestArchive() {
	window.dispatchEvent(new Event(OPEN_ARCHIVE_EVENT));
}
