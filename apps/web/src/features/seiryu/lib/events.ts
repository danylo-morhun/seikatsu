/** Fired by the header's and the bottom nav's New Card buttons; the board opens capture. */
export const NEW_CARD_EVENT = "seiryu:new-card";

export function requestNewCard() {
	window.dispatchEvent(new Event(NEW_CARD_EVENT));
}
