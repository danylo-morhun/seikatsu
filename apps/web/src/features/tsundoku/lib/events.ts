/** Fired by the header's and the bottom nav's Add Book buttons; the library opens capture. */
export const NEW_BOOK_EVENT = "tsundoku:new-book";

export function requestNewBook() {
	window.dispatchEvent(new Event(NEW_BOOK_EVENT));
}
